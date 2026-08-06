import { ptBR } from "date-fns/locale";

const formatRelativeLocale = {
  lastWeek: "dd/MM/yyyy 'às' HH:mm",
  yesterday: "'ontem às' HH:mm",
  today: "'hoje às' HH:mm",
  tomorrow: "dd/MM/yyyy 'às' HH:mm",
  nextWeek: "dd/MM/yyyy 'às' HH:mm",
  other: "dd/MM/yyyy 'às' HH:mm",
};

export const locale = {
  ...ptBR,
  formatRelative: (token: keyof typeof formatRelativeLocale) =>
    formatRelativeLocale[token],
};
