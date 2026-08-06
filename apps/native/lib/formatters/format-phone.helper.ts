export const formatPhone = (phone?: string) => {
  if (!phone) return "";

  const phoneNumber = phone?.replace(/[^\d]+/g, "").replace(/^55/, "");

  if (phoneNumber?.length >= 11) {
    const formattedPhone = `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(
      2,
      7
    )}-${phoneNumber.slice(7, 11)}`;

    return formattedPhone;
  } else {
    return phoneNumber;
  }
};
