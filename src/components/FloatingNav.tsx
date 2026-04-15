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
 * Cercle 48pt semi-transparent draggable qui remplace la tab bar native
 * en bas de l'ecran. Tap pour ouvrir un menu pill horizontal, long-press
 * ~400ms puis drag pour le deplacer, snap automatique vers le bord gauche
 * ou droit le plus proche au lacher. Position persistee en AsyncStorage.
 *
 * Historique des bugs corriges :
 *
 *  - Le PanResponder volait les touches de la WebView qui demarraient
 *    ailleurs et traversaient sa zone (swipe horizontal Instagram broke).
 *    Fix : onMoveShouldSetPanResponder retourne toujours false. Le
 *    PanResponder ne capture QUE les touches qui demarrent sur le bouton
 *    (via onStartShouldSetPanResponder), jamais celles qui se deplacent
 *    vers lui depuis ailleurs.
 *
 *  - Le menu pill s'etendait toujours vers la droite, debordant de
 *    l'ecran quand le bouton etait proche du bord droit. Fix : detection
 *    de position, expansion vers la gauche via flexDirection row-reverse
 *    quand le bouton est sur la moitie droite du viewport.
 *
 *  - Le bouton disparaissait apres certains drags a cause d'incoherences
 *    entre extractOffset/flattenOffset et les valeurs internes de
 *    Animated.ValueXY. Fix : tracking manuel de la position de depart,
 *    sans extractOffset/flattenOffset. Plus simple, plus previsible.
 */

const BUTTON_SIZE = 48;
const LONG_PRESS_DELAY_MS = 400;
const DRAG_CANCEL_THRESHOLD = 8;
const EDGE_MARGIN = 12;
const TOP_SAFE_MARGIN = 60;
const BOTTOM_SAFE_MARGIN = 40;
const MENU_WIDTH = BUTTON_SIZE * 3 - 4; // 3 menu items + padding

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
  const initialX = width - BUTTON_SIZE - EDGE_MARGIN;
  const initialY = TOP_SAFE_MARGIN + 20;

  // Refs qui restent synchronises a travers les closures du PanResponder.
  // Animated.ValueXY piloite l'animation visuelle, mais la "verite" est
  // dans currentPosRef qu'on met a jour a la main.
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const currentPosRef = useRef<NavPosition>({ x: initialX, y: initialY });
  const dragStartRef = useRef<NavPosition>({ x: initialX, y: initialY });
  const dimRef = useRef({ width, height });

  // La source de verite reactive pour decider la direction du menu pill
  // (gauche vs droite). On met a jour via une key dans le state quand
  // menu s'ouvre pour forcer un re-render avec la bonne direction.
  const [menuDirection, setMenuDirection] = useState<'left' | 'right'>('left');
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Keep dimensions ref fresh for PanResponder closures (rotation safety)
  useEffect(() => {
    dimRef.current = { width, height };
  }, [width, height]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement de la position sauvegardee au montage.
  useEffect(() => {
    let cancelled = false;
    loadNavPosition().then((pos) => {
      if (cancelled || !pos) {
        return;
      }
      const clamped = clampPosition(pos, width, height);
      pan.setValue(clamped);
      currentPosRef.current = clamped;
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
      // Capture uniquement les touches qui DEMARRENT sur le bouton.
      onStartShouldSetPanResponder: () => true,
      // Ne JAMAIS voler les touches qui demarrent ailleurs (critique pour
      // que les swipes horizontaux d'Instagram passent a travers).
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        // Snapshot de la position courante comme point de depart du drag.
        dragStartRef.current = { ...currentPosRef.current };
        longPressTimerRef.current = setTimeout(() => {
          isDraggingRef.current = true;
          setIsDragging(true);
        }, LONG_PRESS_DELAY_MS);
      },
      onPanResponderMove: (_, gesture) => {
        if (isDraggingRef.current) {
          // En mode drag : position = start + delta gesture
          const newX = dragStartRef.current.x + gesture.dx;
          const newY = dragStartRef.current.y + gesture.dy;
          pan.setValue({ x: newX, y: newY });
          return;
        }
        // Si l'utilisateur bouge trop avant que le long-press ait tire,
        // on annule le long-press — c'etait un scroll ou un tap qui a
        // glisse, pas une intention de drag.
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
          // Lecture directe de la valeur finale, pas de flattenOffset
          const w = dimRef.current.width;
          const h = dimRef.current.height;
          const endX = (pan.x as unknown as { _value: number })._value;
          const endY = (pan.y as unknown as { _value: number })._value;
          const safeX = isFinite(endX) ? endX : currentPosRef.current.x;
          const safeY = isFinite(endY) ? endY : currentPosRef.current.y;
          const clamped = clampPosition({ x: safeX, y: safeY }, w, h);
          const snapped = snapToEdge(clamped, w);

          Animated.spring(pan, {
            toValue: snapped,
            useNativeDriver: false,
            friction: 8,
            tension: 60,
          }).start(() => {
            // Mise a jour de la verite apres la fin de l'animation
            currentPosRef.current = snapped;
            void saveNavPosition(snapped);
          });

          isDraggingRef.current = false;
          setIsDragging(false);
          return;
        }

        // Tap pur (pas de drag) : on toggle le menu.
        // Avant d'ouvrir, on decide de la direction selon la position
        // actuelle du bouton. Si le bouton est sur la moitie droite du
        // viewport, le menu doit s'etendre vers la gauche pour rester
        // visible a l'ecran.
        const w = dimRef.current.width;
        const buttonCenterX = currentPosRef.current.x + BUTTON_SIZE / 2;
        setMenuDirection(buttonCenterX > w / 2 ? 'left' : 'right');
        setIsMenuOpen((prev) => !prev);
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
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
        <View
          style={[
            styles.menuPill,
            // Ancre le menu a gauche OU a droite du bouton selon la
            // direction calculee au moment du tap.
            menuDirection === 'left'
              ? styles.menuPillAlignRight
              : styles.menuPillAlignLeft,
          ]}
        >
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
        <View style={[styles.button, isDragging && styles.buttonDragging]}>
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
    width: MENU_WIDTH,
  },
  // menuPillAlignRight : le menu part du point de depart du bouton et
  // s'etend vers la gauche. On obtient ca en utilisant un offset negatif
  // a gauche, calcule pour que le bord droit du pill coincide avec le
  // bord droit du bouton.
  menuPillAlignRight: {
    position: 'relative',
    left: -(MENU_WIDTH - BUTTON_SIZE),
  },
  menuPillAlignLeft: {
    position: 'relative',
    left: 0,
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
