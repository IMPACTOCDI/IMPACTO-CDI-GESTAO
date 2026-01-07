import { z } from 'zod';
import * as React from 'react';

// Schemas de validação
export const userSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"]
});

export const projectSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  startDate: z.date(),
  endDate: z.date(),
  status: z.enum(['active', 'on-hold', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  visibility: z.enum(['public', 'private'])
}).refine((data) => data.endDate > data.startDate, {
  message: "Data de término deve ser posterior à data de início",
  path: ["endDate"]
});

export const taskSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  dueDate: z.date().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'doing', 'done']),
  assigneeId: z.string().optional()
});

// Funções de validação
export const validateForm = async <T>(schema: z.ZodSchema<T>, data: unknown): Promise<{ success: boolean; errors?: Record<string, string> }> => {
  try {
    await schema.parseAsync(data);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        if (err.path) {
          errors[err.path.join('.')] = err.message;
        }
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _form: 'Erro de validação' } };
  }
};

// Funções auxiliares
export const formatValidationError = (errors: Record<string, string>): string => {
  return Object.values(errors).join('\n');
};

export const isFormValid = (errors: Record<string, string>): boolean => {
  return Object.keys(errors).length === 0;
};

// Hooks de validação
export const useFormValidation = <T>(schema: z.ZodSchema<T>) => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isValid, setIsValid] = React.useState(true);

  const validate = async (data: unknown) => {
    const result = await validateForm(schema, data);
    setErrors(result.errors || {});
    setIsValid(result.success);
    return result.success;
  };

  const clearErrors = () => {
    setErrors({});
    setIsValid(true);
  };

  return {
    errors,
    isValid,
    validate,
    clearErrors
  };
}; 