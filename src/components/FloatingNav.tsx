import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useFilters } from '../context/FiltersContext';
import { loadNavPosition, saveNavPosition, type NavPosition } from '../storage/uiState';

/**
 * Bouton de navigation flottant d'Authentique.
 *
 * Mono-fonction : bascule entre l'ecran Instagram et l'ecran Parametres.
 * Plus de menu pill a deployer — un simple tap change l'ecran courant.
 *
 *  - Sur Instagram : le bouton affiche "⚙". Tap -> Parametres.
 *  - Sur Parametres : le bouton affiche "←". Tap -> Instagram.
 *
 * Long-press ~400ms puis drag pour deplacer le bouton n'importe ou.
 * Au release, si la preference "Aimanter le bouton" est activee
 * (defaut ON), le bouton glisse vers le bord gauche ou droit le plus
 * proche avec une animation spring. Si elle est OFF, il reste exactement
 * la ou l'utilisateur l'a lache. Position persistee en AsyncStorage.
 *
 * Bugs corriges :
 *  - L'ancien PanResponder avait onMoveShouldSetPanResponder qui renvoyait
 *    true sur les grands mouvements, ce qui volait les touches destinees a
 *    la WebView (swipes Instagram). Il retourne maintenant toujours false
 *    et on ne capture que les touches qui DEMARRENT sur le bouton.
 *  - Le bouton "disparaissait" parfois apres plusieurs drags : c'etait
 *    lie a extractOffset/flattenOffset sur Animated.ValueXY qui
 *    devenaient incoherents. Remplace par un tracking manuel via
 *    dragStartRef + currentPosRef.
 *  - currentPosRef est maintenant mis a jour IMMEDIATEMENT au lacher
 *    du drag (avant que la spring anime), pour qu'un tap suivant
 *    lise toujours la derniere position connue.
 */

const BUTTON_SIZE = 48;
const LONG_PRESS_DELAY_MS = 400;
const DRAG_CANCEL_THRESHOLD = 8;
const EDGE_MARGIN = 12;
const TOP_SAFE_MARGIN = 60;
const BOTTOM_SAFE_MARGIN = 40;

export function FloatingNav({ state, navigation }: BottomTabBarProps) {
  const { width, height } = useWindowDimensions();
  const { prefs } = useFilters();

  // Position initiale : haut-droite, sous la barre de status iOS.
  const initialX = width - BUTTON_SIZE - EDGE_MARGIN;
  const initialY = TOP_SAFE_MARGIN + 20;

  // Animated.ValueXY pour le rendu fluide du drag, currentPosRef comme
  // source de verite logique pour les handlers.
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const currentPosRef = useRef<NavPosition>({ x: initialX, y: initialY });
  const dragStartRef = useRef<NavPosition>({ x: initialX, y: initialY });
  const dimRef = useRef({ width, height });
  const snapEnabledRef = useRef(prefs.navSnapToEdge);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Refs sync pour que les closures du PanResponder voient la valeur courante.
  useEffect(() => {
    dimRef.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    snapEnabledRef.current = prefs.navSnapToEdge;
  }, [prefs.navSnapToEdge]);

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
      // CRUCIAL : ne JAMAIS voler les touches qui demarrent ailleurs,
      // sinon on casse les swipes horizontaux d'Instagram.
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        dragStartRef.current = { ...currentPosRef.current };
        longPressTimerRef.current = setTimeout(() => {
          isDraggingRef.current = true;
          setIsDragging(true);
        }, LONG_PRESS_DELAY_MS);
      },
      onPanResponderMove: (_, gesture) => {
        if (isDraggingRef.current) {
          const newX = dragStartRef.current.x + gesture.dx;
          const newY = dragStartRef.current.y + gesture.dy;
          pan.setValue({ x: newX, y: newY });
          return;
        }
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
          const w = dimRef.current.width;
          const h = dimRef.current.height;
          const endX = (pan.x as unknown as { _value: number })._value;
          const endY = (pan.y as unknown as { _value: number })._value;
          const safeX = isFinite(endX) ? endX : currentPosRef.current.x;
          const safeY = isFinite(endY) ? endY : currentPosRef.current.y;
          const clamped = clampPosition({ x: safeX, y: safeY }, w, h);
          const final = snapEnabledRef.current
            ? snapToEdge(clamped, w)
            : clamped;

          // MAJ de la verite IMMEDIATEMENT, avant le spring. Comme ca,
          // un tap juste apres le release lit deja la bonne position.
          currentPosRef.current = final;
          void saveNavPosition(final);

          Animated.spring(pan, {
            toValue: final,
            useNativeDriver: false,
            friction: 8,
            tension: 60,
          }).start();

          isDraggingRef.current = false;
          setIsDragging(false);
          return;
        }

        // Tap pur : bascule vers l'autre ecran.
        const currentRouteName = state.routes[state.index]?.name;
        const nextRoute = currentRouteName === 'Instagram' ? 'Paramètres' : 'Instagram';
        navigation.navigate(nextRoute as never);
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        isDraggingRef.current = false;
        setIsDragging(false);
      },
    }),
  ).current;

  const currentRouteName = state.routes[state.index]?.name ?? 'Instagram';
  const glyph = currentRouteName === 'Instagram' ? '⚙' : '←';

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
      <View style={[styles.button, isDragging && styles.buttonDragging]}>
        <Text style={styles.buttonText}>{glyph}</Text>
      </View>
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
    color: '#fafaf7',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 26,
  },
});
