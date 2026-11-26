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
  // DroidPy is intentionally phone-first on every Android form factor.
  // Large screens use the same single-workspace navigation instead of desktop split panes.
  return { deviceClass: 'phone', isLandscape, width, height };
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
