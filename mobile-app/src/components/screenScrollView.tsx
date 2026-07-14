import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export function ScreenScrollView(props: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      const resetHandle = setTimeout(() => {
        scrollRef.current?.scrollTo({ animated: false, y: 0 });
      }, 0);

      return () => clearTimeout(resetHandle);
    }, [])
  );

  return <ScrollView {...props} ref={scrollRef} />;
}
