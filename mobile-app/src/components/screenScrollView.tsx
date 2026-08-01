import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps
} from 'react-native';

type ScreenScrollViewProps = ScrollViewProps & {
  memoryKey?: string;
};

const rememberedOffsets = new Map<string, number>();

export function ScreenScrollView({
  contentOffset,
  memoryKey,
  onScroll,
  scrollEventThrottle,
  ...props
}: ScreenScrollViewProps) {
  const rememberedOffset = memoryKey
    ? rememberedOffsets.get(memoryKey) ?? 0
    : 0;

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (memoryKey) {
      rememberedOffsets.set(memoryKey, event.nativeEvent.contentOffset.y);
    }
    onScroll?.(event);
  };

  return (
    <ScrollView
      {...props}
      contentOffset={contentOffset ?? (
        memoryKey
          ? { x: 0, y: rememberedOffset }
          : undefined
      )}
      onScroll={memoryKey || onScroll ? handleScroll : undefined}
      scrollEventThrottle={scrollEventThrottle ?? (memoryKey ? 16 : undefined)}
    />
  );
}
