import "@/unistyles";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { FormErrorText } from "@/components/form/error-text";

type FormInputProps<T extends FieldValues> = {
  control: Control<T, any, any>;
  name: Path<T>;
  label?: string;
  prefix?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Sobrescreve o box (row ou textArea) que envolve o input — não se aplica ao input "plain" sem prefixo/multiline. */
  boxStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Formata o valor armazenado no form para exibição no input. */
  formatValue?: (raw: string) => string;
  /** Transforma o texto digitado antes de armazenar no form. */
  parseValue?: (input: string) => string;
  /** Efeito colateral rodado após a mudança (ex.: disparar autofill de CEP). */
  onValueChange?: (value: string) => void;
} & Pick<
  TextInputProps,
  "placeholder" | "keyboardType" | "autoCapitalize" | "maxLength" | "editable" | "onSubmitEditing"
>;

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  prefix,
  multiline,
  containerStyle,
  boxStyle,
  inputStyle,
  formatValue,
  parseValue,
  onValueChange,
  ...inputProps
}: FormInputProps<T>) {
  const { theme } = useUnistyles();
  const { field, fieldState } = useController({ control, name });
  const rawValue = (field.value as string | undefined) ?? "";
  const displayValue = formatValue ? formatValue(rawValue) : rawValue;
  const handleChangeText = (text: string) => {
    const next = parseValue ? parseValue(text) : text;
    field.onChange(next);
    onValueChange?.(next);
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      {prefix ? (
        <View style={[styles.row, boxStyle, fieldState.error && styles.errorBorder]}>
          <Text style={styles.prefix}>{prefix}</Text>
          <TextInput
            style={[styles.rowInput, inputStyle]}
            value={displayValue}
            onChangeText={handleChangeText}
            onBlur={field.onBlur}
            placeholderTextColor={theme.colors.mutedForeground}
            {...inputProps}
          />
        </View>
      ) : multiline ? (
        <View style={[styles.textArea, boxStyle, fieldState.error && styles.errorBorder]}>
          <TextInput
            style={[styles.textAreaInput, inputStyle]}
            value={displayValue}
            onChangeText={handleChangeText}
            onBlur={field.onBlur}
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
            {...inputProps}
          />
        </View>
      ) : (
        <TextInput
          style={[styles.input, fieldState.error && styles.errorBorder, inputStyle]}
          value={displayValue}
          onChangeText={handleChangeText}
          onBlur={field.onBlur}
          placeholderTextColor={theme.colors.mutedForeground}
          {...inputProps}
        />
      )}
      {fieldState.error?.message && <FormErrorText>{fieldState.error.message}</FormErrorText>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 9,
  },
  input: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
  },
  textArea: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
  },
  textAreaInput: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
    lineHeight: 22,
    minHeight: 66,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,44,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
  },
  prefix: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginRight: 6,
  },
  rowInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
    paddingVertical: 13,
  },
  errorBorder: {
    borderColor: theme.colors.destructive,
  },
}));
