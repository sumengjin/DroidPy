import { useEffect, useState } from 'react';
import { DeviceClass } from '../types/ide';

export interface DeviceLayoutInfo {
  deviceClass: DeviceClass;
  isLandscape: boolean;
  width: number;
  height: number;
}

function computeLayout(): DeviceLayoutInfo {
  if (typeof window === 'undefined') {
    return { deviceClass: 'phone', isLandscape: false, width: 390, height: 844 };
  }

  // Android's IME shrinks the visual viewport and fires resize. Use physical
  // screen dimensions for orientation/device class so opening an input never
  // remounts the editor and drops keyboard focus.
  const width = window.innerWidth;
  const screenWidth = window.screen.width || width;
  const screenHeight = window.screen.height || window.innerHeight;
  const orientationType = window.screen.orientation?.type;
  const isLandscape = orientationType
    ? orientationType.startsWith('landscape')
    : screenWidth > screenHeight;
  const minSide = Math.min(screenWidth, screenHeight);
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Keep landscape phones in the phone workspace even when their CSS width
  // exceeds the usual tablet breakpoint. A genuinely wide touch display
  // (including a tablet in portrait or landscape) retains the split workspace.
  const isPhone = width < 768 || (isCoarsePointer && minSide < 520 && width < 980);

  return {
    deviceClass: isPhone ? 'phone' : 'tablet',
    isLandscape,
    width,
    height,
  };
}

export function useDeviceLayout(): DeviceLayoutInfo {
  const [layout, setLayout] = useState<DeviceLayoutInfo>(computeLayout);

  useEffect(() => {
    const onResize = () => setLayout(computeLayout());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return layout;
}
