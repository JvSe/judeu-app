import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ReactNode } from "react";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { FormErrorText } from "@/components/form/error-text";

type FormCheckboxProps<T extends FieldValues> = {
  control: Control<T, any, any>;
  name: Path<T>;
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function FormCheckbox<T extends FieldValues>({
  control,
  name,
  children,
  containerStyle,
}: FormCheckboxProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const checked = !!field.value;

  return (
    <View style={containerStyle}>
      <Pressable style={styles.row} onPress={() => field.onChange(!checked)}>
        <View style={[styles.checkbox, !checked && styles.checkboxOff]}>
          {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
        {children}
      </Pressable>
      {fieldState.error?.message && <FormErrorText>{fieldState.error.message}</FormErrorText>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOff: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
}));
