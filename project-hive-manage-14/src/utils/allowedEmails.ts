
// Lista de e-mails permitidos para registro
// Em produção, isso deve vir de uma variável de ambiente ou banco de dados
export const ALLOWED_EMAILS = [
  'admin@company.com',
  'manager@company.com',
  'team@company.com',
  'user@company.com',
  // Adicione mais e-mails conforme necessário
];

// Função para verificar se um e-mail está na lista de permitidos
export const isEmailAllowed = (email: string): boolean => {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
};

// Função para validar formato de e-mail
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
