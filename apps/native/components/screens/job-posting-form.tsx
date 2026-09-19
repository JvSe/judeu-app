import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useController, useFieldArray, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { FormCheckbox } from "@/components/form/checkbox";
import { FormChipSelect } from "@/components/form/chip-select";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import type { Category, CreateJobPostingInput, JobContractType, JobShift, JobWeekday } from "@/lib/api";
import { TIME_RE, WEEKDAY_LABELS } from "@/lib/format";

const CONTRACT_TYPE_OPTIONS: { value: JobContractType; label: string }[] = [
  { value: "CLT", label: "CLT" },
  { value: "PJ", label: "PJ" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "TEMPORARY", label: "Temporário" },
];

const WEEKDAY_OPTIONS = (Object.keys(WEEKDAY_LABELS) as JobWeekday[]).map((value) => ({
  value,
  label: WEEKDAY_LABELS[value],
}));

const shiftSchema = z
  .object({
    weekday: z.string().min(1, "Escolha o dia"),
    startTime: z.string().regex(TIME_RE, "Use o formato HH:mm"),
    endTime: z.string().regex(TIME_RE, "Use o formato HH:mm"),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "O início deve ser antes do fim",
    path: ["endTime"],
  });

const jobPostingSchema = z
  .object({
    categoryId: z.string().min(1, "Escolha uma categoria."),
    title: z.string().trim().min(3, "Título muito curto"),
    description: z.string().trim().min(10, "Descreva melhor a vaga"),
    contractType: z.string().min(1, "Escolha o tipo de contrato."),
    salaryNegotiable: z.boolean(),
    salary: z.string(),
    shifts: z.array(shiftSchema).min(1, "Adicione ao menos um turno"),
  })
  .superRefine((data, ctx) => {
    if (data.salaryNegotiable) return;
    const cents = Math.round(Number(data.salary.replace(",", ".")) * 100);
    if (!data.salary.trim() || !Number.isFinite(cents) || cents <= 0) {
      ctx.addIssue({
        code: "custom",
        message: 'Informe o salário ou marque "a combinar"',
        path: ["salary"],
      });
    }
  });

type JobPostingFormInput = z.input<typeof jobPostingSchema>;
type JobPostingFormOutput = z.output<typeof jobPostingSchema>;

function toFormValues(initial?: CreateJobPostingInput): JobPostingFormInput {
  return {
    categoryId: initial?.categoryId ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    contractType: initial?.contractType ?? "",
    salaryNegotiable: initial ? initial.salaryCents == null : false,
    salary:
      initial?.salaryCents != null ? (initial.salaryCents / 100).toFixed(2).replace(".", ",") : "",
    shifts: initial?.shifts?.length ? initial.shifts : [],
  };
}

function toCreateInput(data: JobPostingFormOutput): CreateJobPostingInput {
  return {
    categoryId: data.categoryId,
    title: data.title,
    description: data.description,
    contractType: data.contractType as JobContractType,
    salaryCents: data.salaryNegotiable
      ? undefined
      : Math.round(Number(data.salary.replace(",", ".")) * 100),
    shifts: data.shifts as JobShift[],
  };
}

type JobPostingFormProps = {
  categories: Category[];
  initial?: CreateJobPostingInput;
  confirmLabel: string;
  submitting?: boolean;
  onConfirm: (input: CreateJobPostingInput) => void;
};

export function JobPostingForm({
  categories,
  initial,
  confirmLabel,
  submitting,
  onConfirm,
}: JobPostingFormProps) {
  const { theme } = useUnistyles();
  const { control, handleSubmit, reset, formState } = useForm<
    JobPostingFormInput,
    unknown,
    JobPostingFormOutput
  >({
    resolver: zodResolver(jobPostingSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: toFormValues(initial),
  });
  const { field: salaryNegotiableField } = useController({ control, name: "salaryNegotiable" });
  const { fields, append, remove } = useFieldArray({ control, name: "shifts" });

  useEffect(() => {
    if (initial) reset(toFormValues(initial));
  }, [initial, reset]);

  const onValid = handleSubmit((data) => onConfirm(toCreateInput(data)));

  return (
    <View>
      <Text style={styles.label}>Categoria</Text>
      <FormChipSelect
        control={control}
        name="categoryId"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />

      <Text style={styles.label}>Título da vaga</Text>
      <FormInput control={control} name="title" placeholder="Ex.: Auxiliar de limpeza" />

      <Text style={styles.label}>Descrição</Text>
      <FormInput
        control={control}
        name="description"
        placeholder="Responsabilidades, requisitos, benefícios..."
        multiline
      />

      <Text style={styles.label}>Tipo de contrato</Text>
      <FormChipSelect control={control} name="contractType" options={CONTRACT_TYPE_OPTIONS} />

      <Text style={styles.label}>Salário</Text>
      <FormInput
        control={control}
        name="salary"
        placeholder="Ex.: 1800,00"
        keyboardType="decimal-pad"
        editable={!salaryNegotiableField.value}
      />
      <FormCheckbox control={control} name="salaryNegotiable" containerStyle={styles.negotiableRow}>
        <Text style={styles.negotiableText}>Salário a combinar</Text>
      </FormCheckbox>

      <Text style={styles.label}>Escala de trabalho</Text>
      {fields.map((field, index) => (
        <View key={field.id} style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <Text style={styles.shiftLabel}>Turno {index + 1}</Text>
            <Pressable onPress={() => remove(index)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.destructive} />
            </Pressable>
          </View>
          <FormChipSelect
            control={control}
            name={`shifts.${index}.weekday`}
            options={WEEKDAY_OPTIONS}
          />
          <View style={styles.timeRow}>
            <FormInput
              control={control}
              name={`shifts.${index}.startTime`}
              label="Início"
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              containerStyle={{ flex: 1 }}
            />
            <FormInput
              control={control}
              name={`shifts.${index}.endTime`}
              label="Fim"
              placeholder="17:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              containerStyle={{ flex: 1 }}
            />
          </View>
        </View>
      ))}

      <Pressable
        style={styles.addButton}
        onPress={() => append({ weekday: "", startTime: "", endTime: "" })}
        hitSlop={10}
      >
        <Ionicons name="add" size={18} color={theme.colors.primary} />
        <Text style={styles.addButtonText}>Adicionar turno</Text>
      </Pressable>
      {formState.errors.shifts?.root?.message && (
        <FormErrorText>{formState.errors.shifts.root.message}</FormErrorText>
      )}
      {formState.errors.shifts?.message && (
        <FormErrorText>{formState.errors.shifts.message}</FormErrorText>
      )}

      <Pressable
        style={({ pressed }) => [styles.confirmButton, { opacity: pressed || submitting ? 0.9 : 1 }]}
        onPress={onValid}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 9,
    marginTop: 16,
  },
  negotiableRow: {
    marginTop: 12,
  },
  negotiableText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  shiftCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    gap: 10,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shiftLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,102,0,0.5)",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 20,
    marginTop: 4,
  },
  addButtonText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
  },
  confirmText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
