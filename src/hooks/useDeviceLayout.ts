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
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const minSide = Math.min(width, height);

  // Landscape phones often have width 700-920px but short height < 520px
  if (width < 768 || (isCoarsePointer && minSide < 520 && width < 980)) {
    return { deviceClass: 'phone', isLandscape, width, height };
  }
  return { deviceClass: 'tablet', isLandscape, width, height };
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
