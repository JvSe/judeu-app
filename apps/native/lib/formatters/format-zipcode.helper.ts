export const formatZipCode = (zipCode?: string) => {
  if (!zipCode) return "";

  const numericZipCode = zipCode.replace(/\D/g, "");

  if (numericZipCode.length === 8) {
    return `${numericZipCode.slice(0, 5)}-${numericZipCode.slice(5, 8)}`;
  }

  return numericZipCode;
};
