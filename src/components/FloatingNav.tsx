import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { loadNavPosition, saveNavPosition, type NavPosition } from '../storage/uiState';

/**
 * Bouton de navigation flottant d'Authentique.
 *
 * Remplace la RN tab bar classique (qui volait de la place en bas et
 * recouvrait parfois les boutons natifs d'Instagram ou Facebook). Ce
 * composant est un cercle 48pt semi-transparent qu'on peut :
 *
 *  - Tapoter pour ouvrir un "menu pill" horizontal qui propose les 3
 *    onglets (Instagram / Facebook / Parametres) cote-a-cote.
 *  - Maintenir appuye ~400ms puis glisser pour le deplacer n'importe
 *    ou sur l'ecran. Au lacher, le bouton "snap" vers le bord gauche
 *    ou droit le plus proche (comportement a la Messenger chat heads)
 *    pour ne pas rester au milieu de l'ecran.
 *  - Sa position est sauvegardee en AsyncStorage via uiState.ts et
 *    restauree au prochain lancement.
 *
 * React Navigation injecte ce composant via le prop `tabBar` de
 * Tab.Navigator, ce qui nous donne automatiquement acces a l'etat de
 * navigation (`state`) et a l'objet `navigation` pour naviguer entre
 * les onglets, sans avoir besoin de navigationRef ou de Context custom.
 */

const BUTTON_SIZE = 48;
const LONG_PRESS_DELAY_MS = 400;
const DRAG_CANCEL_THRESHOLD = 8;
const EDGE_MARGIN = 12;
const TOP_SAFE_MARGIN = 60;
const BOTTOM_SAFE_MARGIN = 40;

type TabMeta = { letter: string; color: string };

const TAB_META: Record<string, TabMeta> = {
  Instagram: { letter: 'I', color: '#fafaf7' },
  Facebook: { letter: 'F', color: '#fafaf7' },
  Paramètres: { letter: '⚙', color: '#fafaf7' },
};

const TAB_ORDER = ['Instagram', 'Facebook', 'Paramètres'] as const;

export function FloatingNav({ state, navigation }: BottomTabBarProps) {
  const { width, height } = useWindowDimensions();

  // Position initiale : haut-droite, sous la barre de status iOS.
  // On la stocke dans une Animated.ValueXY pour que le drag soit
  // smooth (pas de re-render React a chaque frame).
  const initialX = width - BUTTON_SIZE - EDGE_MARGIN;
  const initialY = TOP_SAFE_MARGIN + 20;

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const currentPositionRef = useRef<NavPosition>({ x: initialX, y: initialY });

  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Ref sync avec isDragging pour que le closure du PanResponder
  // voie toujours la valeur a jour (sinon il garde la valeur initiale
  // capturee a la creation du PanResponder).
  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement de la position sauvegardee au montage.
  useEffect(() => {
    let cancelled = false;
    loadNavPosition().then((pos) => {
      if (cancelled || !pos) {
        return;
      }
      // Clamp aux dimensions actuelles de l'ecran, au cas ou l'utilisateur
      // ait tourne son iPhone ou change de device entre deux lancements.
      const clamped = clampPosition(pos, width, height);
      pan.setValue(clamped);
      currentPositionRef.current = clamped;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return (
          isDraggingRef.current ||
          Math.abs(gesture.dx) > DRAG_CANCEL_THRESHOLD ||
          Math.abs(gesture.dy) > DRAG_CANCEL_THRESHOLD
        );
      },
      onPanResponderGrant: () => {
        // On capture la position actuelle comme offset et on remet
        // la valeur courante a 0 — ca permet de calculer les deltas
        // du gesture directement sans avoir a suivre l'offset a la main.
        pan.extractOffset();
        longPressTimerRef.current = setTimeout(() => {
          isDraggingRef.current = true;
          setIsDragging(true);
        }, LONG_PRESS_DELAY_MS);
      },
      onPanResponderMove: (_, gesture) => {
        if (isDraggingRef.current) {
          pan.setValue({ x: gesture.dx, y: gesture.dy });
          return;
        }
        // Si l'utilisateur bouge trop avant que le long-press ait tire,
        // on annule le long-press — il voulait scroller dans la WebView,
        // pas deplacer le bouton.
        if (
          Math.abs(gesture.dx) > DRAG_CANCEL_THRESHOLD ||
          Math.abs(gesture.dy) > DRAG_CANCEL_THRESHOLD
        ) {
          clearLongPressTimer();
        }
      },
      onPanResponderRelease: () => {
        clearLongPressTimer();

        if (isDraggingRef.current) {
          // Fin d'un drag : on fige l'offset, on clamp et on snap au bord.
          pan.flattenOffset();
          const rawX = (pan.x as unknown as { _value: number })._value;
          const rawY = (pan.y as unknown as { _value: number })._value;
          const clamped = clampPosition({ x: rawX, y: rawY }, width, height);
          const snapped = snapToEdge(clamped, width);
          Animated.spring(pan, {
            toValue: snapped,
            useNativeDriver: false,
            friction: 8,
            tension: 60,
          }).start(() => {
            currentPositionRef.current = snapped;
            void saveNavPosition(snapped);
          });
          isDraggingRef.current = false;
          setIsDragging(false);
          return;
        }

        // Tap pur (pas de drag) : on annule l'offset et on toggle le menu.
        pan.flattenOffset();
        setIsMenuOpen((prev) => !prev);
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        pan.flattenOffset();
        isDraggingRef.current = false;
        setIsDragging(false);
      },
    }),
  ).current;

  const activeRouteName = state.routes[state.index]?.name ?? 'Instagram';
  const activeMeta = TAB_META[activeRouteName] ?? TAB_META.Instagram;

  const handleSelectTab = (routeName: string) => {
    setIsMenuOpen(false);
    navigation.navigate(routeName as never);
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
    >
      {isMenuOpen ? (
        <View style={styles.menuPill}>
          {TAB_ORDER.map((routeName) => {
            const meta = TAB_META[routeName];
            const isActive = routeName === activeRouteName;
            return (
              <Pressable
                key={routeName}
                onPress={() => handleSelectTab(routeName)}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                hitSlop={6}
              >
                <Text style={styles.menuItemText}>{meta.letter}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.button,
            isDragging && styles.buttonDragging,
          ]}
        >
          <Text style={[styles.buttonText, { color: activeMeta.color }]}>
            {activeMeta.letter}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

function clampPosition(pos: NavPosition, width: number, height: number): NavPosition {
  return {
    x: Math.max(EDGE_MARGIN, Math.min(width - BUTTON_SIZE - EDGE_MARGIN, pos.x)),
    y: Math.max(
      TOP_SAFE_MARGIN,
      Math.min(height - BUTTON_SIZE - BOTTOM_SAFE_MARGIN, pos.y),
    ),
  };
}

function snapToEdge(pos: NavPosition, width: number): NavPosition {
  const leftEdge = EDGE_MARGIN;
  const rightEdge = width - BUTTON_SIZE - EDGE_MARGIN;
  const centerX = pos.x + BUTTON_SIZE / 2;
  const snappedX = centerX < width / 2 ? leftEdge : rightEdge;
  return { x: snappedX, y: pos.y };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // zIndex eleve pour rester au-dessus de la WebView
    zIndex: 1000,
    elevation: 10,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(28, 28, 26, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    // Petite ombre pour flotter "par-dessus" le contenu
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonDragging: {
    backgroundColor: 'rgba(28, 28, 26, 0.92)',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    transform: [{ scale: 1.08 }],
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 26, 0.88)',
    borderRadius: BUTTON_SIZE / 2,
    padding: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  menuItem: {
    width: BUTTON_SIZE - 12,
    height: BUTTON_SIZE - 12,
    borderRadius: (BUTTON_SIZE - 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  menuItemActive: {
    backgroundColor: 'rgba(250, 250, 247, 0.18)',
  },
  menuItemText: {
    color: '#fafaf7',
    fontSize: 16,
    fontWeight: '600',
  },
});
