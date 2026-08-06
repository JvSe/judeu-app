import "@/unistyles";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { FormErrorText } from "@/components/form/error-text";

type ChipOption = { value: string; label: string };

type FormChipSelectProps<T extends FieldValues> = {
  control: Control<T, any, any>;
  name: Path<T>;
  options: ChipOption[];
  /** Quando true, o campo guarda um array de valores selecionados em vez de um único valor. */
  multiple?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
};

export function FormChipSelect<T extends FieldValues>({
  control,
  name,
  options,
  multiple,
  containerStyle,
  rowStyle,
}: FormChipSelectProps<T>) {
  const { field, fieldState } = useController({ control, name });

  const isActive = (value: string) =>
    multiple ? ((field.value as string[] | undefined) ?? []).includes(value) : field.value === value;

  const toggle = (value: string) => {
    if (!multiple) {
      field.onChange(value);
      return;
    }
    const current = (field.value as string[] | undefined) ?? [];
    field.onChange(
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };

  return (
    <View style={containerStyle}>
      <View style={[styles.chipRow, rowStyle]}>
        {options.map((opt) => {
          const active = isActive(opt.value);
          return (
            <Pressable key={opt.value} onPress={() => toggle(opt.value)}>
              <View style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {fieldState.error?.message && <FormErrorText>{fieldState.error.message}</FormErrorText>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  chipTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
}));
