import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ReactNode } from "react";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { FormErrorText } from "@/components/form/error-text";

type FormTextFieldProps<T extends FieldValues> = {
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  rightAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Formata o valor armazenado no form para exibição no input (ex.: máscara de telefone). */
  formatValue?: (raw: string) => string;
  /** Transforma o texto digitado antes de armazenar no form (ex.: remove máscara). */
  parseValue?: (input: string) => string;
  /** Efeito colateral rodado após a mudança (ex.: disparar autofill de CEP). */
  onValueChange?: (value: string) => void;
} & Pick<
  TextInputProps,
  | "placeholder"
  | "secureTextEntry"
  | "keyboardType"
  | "autoCapitalize"
  | "autoComplete"
  | "autoCorrect"
  | "editable"
  | "maxLength"
  | "onSubmitEditing"
>;

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  icon,
  rightAccessory,
  containerStyle,
  inputStyle,
  formatValue,
  parseValue,
  onValueChange,
  ...inputProps
}: FormTextFieldProps<T>) {
  const { theme } = useUnistyles();
  const { field, fieldState } = useController({ control, name });
  const rawValue = (field.value as string | undefined) ?? "";

  return (
    <View style={[styles.block, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, fieldState.error && styles.fieldErrorBorder]}>
        <Ionicons name={icon} size={18} color={theme.colors.mutedForeground} />
        <TextInput
          style={[
            styles.fieldValue,
            inputProps.secureTextEntry && rawValue.length > 0 && styles.password,
            inputStyle,
          ]}
          value={formatValue ? formatValue(rawValue) : rawValue}
          onChangeText={(text) => {
            const next = parseValue ? parseValue(text) : text;
            field.onChange(next);
            onValueChange?.(next);
          }}
          onBlur={field.onBlur}
          placeholderTextColor={theme.colors.mutedForeground}
          autoCorrect={false}
          {...inputProps}
        />
        {rightAccessory}
      </View>
      {fieldState.error?.message && <FormErrorText>{fieldState.error.message}</FormErrorText>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  block: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  field: {
    height: 54,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  fieldErrorBorder: {
    borderColor: theme.colors.destructive,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  password: {
    fontSize: 18,
    letterSpacing: 3,
  },
}));
