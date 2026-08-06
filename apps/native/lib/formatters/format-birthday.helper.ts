export const formatBirthday = (input?: string) => {
  const numericInput = input?.replace(/\D/g, "") ?? "";

  let formattedBirthday = "";

  for (let i = 0; i < numericInput.length && i < 8; i++) {
    if (i == 2 || i == 4) {
      formattedBirthday += "/";
    }
    formattedBirthday += numericInput[i];
  }

  return formattedBirthday;
};
