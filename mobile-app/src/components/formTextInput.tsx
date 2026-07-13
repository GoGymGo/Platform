import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle
} from 'react-native';

import {
  borders,
  colors,
  componentSizes,
  fontFamilies,
  fontSizes,
  interactionStates,
  radii,
  spacing
} from '@/constants/theme';

type FormTextInputProps = Omit<TextInputProps, 'style'> & {
  style?: StyleProp<TextStyle>;
};

export function FormTextInput({
  accessibilityState,
  editable = true,
  onBlur,
  onFocus,
  placeholderTextColor = colors.dim,
  selectionColor = colors.cyan,
  style,
  ...props
}: FormTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      accessibilityState={{ ...accessibilityState, disabled: !editable }}
      editable={editable}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      placeholderTextColor={placeholderTextColor}
      selectionColor={selectionColor}
      style={[
        styles.input,
        focused ? styles.focused : null,
        !editable ? styles.disabled : null,
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: componentSizes.inputHeight,
    paddingHorizontal: spacing.lg,
    borderWidth: borders.hairline,
    borderColor: colors.borderInteractive,
    borderRadius: radii.sm,
    color: colors.text,
    backgroundColor: colors.surfaceInteractive,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control,
    outlineWidth: 0
  },
  focused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surfaceRaised
  },
  disabled: {
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.surfaceDisabled,
    ...interactionStates.disabled
  }
});
