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
 * Un simple tap change l'ecran courant. Long-press ~400ms + drag pour
 * deplacer, avec snap-to-edge optionnel.
 *
 *  - Sur Instagram : glyphe "☰" (menu). Tap -> Parametres.
 *  - Sur Parametres : glyphe "←" (retour). Tap -> Instagram.
 *
 * Historique des bugs corriges :
 *
 *  - PanResponder volant les touches de la WebView qui demarraient
 *    ailleurs (cassait le swipe Instagram). Fix : onMove renvoie toujours
 *    false, on capture uniquement les touches qui demarrent sur nous.
 *
 *  - currentPosRef mis a jour en callback de spring (trop tard), causant
 *    un "bouton qui disparait apres drag". Fix : MAJ immediate au release,
 *    spring purement visuel.
 *
 *  - State React (state.routes[state.index].name) capture dans la closure
 *    du PanResponder au premier render, devenant stale apres une
 *    navigation. Du coup le retour Parametres -> Instagram ne marchait
 *    pas (le handler voyait toujours "Instagram" et tentait d'aller sur
 *    "Parametres", ou on etait deja). Fix : stateRef mise a jour via
 *    useEffect sur le prop state, et lue dans le handler.
 *
 *  - Auto-snap quand l'utilisateur active "Aimanter" dans les parametres :
 *    un useEffect detecte la transition false -> true et anime le bouton
 *    vers le bord le plus proche automatiquement.
 */

const BUTTON_SIZE = 48;
const LONG_PRESS_DELAY_MS = 400;
const DRAG_CANCEL_THRESHOLD = 8;
const EDGE_MARGIN = 12;
const TOP_SAFE_MARGIN = 60;
const BOTTOM_SAFE_MARGIN = 40;

function getDefaultPosition(width: number, height: number): NavPosition {
  // Milieu-droite par defaut — ergonomique pour un pouce droitier
  // et plus discret que le coin haut-droite ou se trouvent les icones
  // de Story / Like natives d'Instagram.
  return {
    x: width - BUTTON_SIZE - EDGE_MARGIN,
    y: Math.max(TOP_SAFE_MARGIN, height / 2 - BUTTON_SIZE / 2),
  };
}

export function FloatingNav({ state, navigation }: BottomTabBarProps) {
  const { width, height } = useWindowDimensions();
  const { prefs } = useFilters();

  const defaultPos = getDefaultPosition(width, height);

  const pan = useRef(new Animated.ValueXY(defaultPos)).current;
  const currentPosRef = useRef<NavPosition>(defaultPos);
  const dragStartRef = useRef<NavPosition>(defaultPos);
  const dimRef = useRef({ width, height });
  const snapEnabledRef = useRef(prefs.navSnapToEdge);

  // Closures React Navigation : le `state` et `navigation` props sont mis
  // a jour a chaque changement, mais le PanResponder est cree une seule
  // fois via useRef et garde l'ancienne valeur dans sa closure. On passe
  // par un ref mis a jour a chaque render pour que le handler voie la
  // derniere valeur.
  const stateRef = useRef(state);
  const navigationRef = useRef(navigation);
  useEffect(() => {
    stateRef.current = state;
    navigationRef.current = navigation;
  }, [state, navigation]);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    dimRef.current = { width, height };
  }, [width, height]);

  // Auto-snap : quand prefs.navSnapToEdge passe de false a true, on anime
  // le bouton vers le bord le plus proche pour "remettre de l'ordre".
  const prevSnapRef = useRef(prefs.navSnapToEdge);
  useEffect(() => {
    const wasOff = !prevSnapRef.current;
    const isOn = prefs.navSnapToEdge;
    snapEnabledRef.current = isOn;
    if (wasOff && isOn) {
      const cur = currentPosRef.current;
      const snapped = snapToEdge(cur, dimRef.current.width);
      currentPosRef.current = snapped;
      void saveNavPosition(snapped);
      Animated.spring(pan, {
        toValue: snapped,
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }).start();
    }
    prevSnapRef.current = isOn;
  }, [prefs.navSnapToEdge, pan]);

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
      onStartShouldSetPanResponder: () => true,
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

        // Tap : bascule via stateRef + navigationRef (valeurs courantes).
        const currentState = stateRef.current;
        const currentRouteName = currentState.routes[currentState.index]?.name;
        const nextRoute = currentRouteName === 'Instagram' ? 'Paramètres' : 'Instagram';
        navigationRef.current.navigate(nextRoute as never);
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        isDraggingRef.current = false;
        setIsDragging(false);
      },
    }),
  ).current;

  const currentRouteName = state.routes[state.index]?.name ?? 'Instagram';
  const glyph = currentRouteName === 'Instagram' ? '☰' : '←';

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

/**
 * Helper utilise par SettingsScreen pour reinitialiser la position du
 * bouton depuis Parametres. Retour a la position par defaut.
 */
export async function resetNavPositionToDefault(width: number, height: number): Promise<NavPosition> {
  const def = getDefaultPosition(width, height);
  await saveNavPosition(def);
  return def;
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
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 28,
  },
});
