
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface FormValidationProps {
  errors: string[];
  success?: string;
  className?: string;
}

export const FormValidation: React.FC<FormValidationProps> = ({ 
  errors, 
  success, 
  className 
}) => {
  if (!errors.length && !success) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {errors.map((error, index) => (
        <Alert key={index} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

// Hook para validação de formulários
export const useFormValidation = () => {
  const [errors, setErrors] = React.useState<string[]>([]);
  const [success, setSuccess] = React.useState<string>('');

  const addError = (error: string) => {
    setErrors(prev => [...prev, error]);
  };

  const setError = (error: string) => {
    setErrors([error]);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const setSuccessMessage = (message: string) => {
    setSuccess(message);
    setErrors([]);
  };

  const clearAll = () => {
    setErrors([]);
    setSuccess('');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      addError('E-mail inválido');
      return false;
    }
    return true;
  };

  const validateRequired = (value: string, fieldName: string): boolean => {
    if (!value.trim()) {
      addError(`${fieldName} é obrigatório`);
      return false;
    }
    return true;
  };

  const validateMinLength = (value: string, minLength: number, fieldName: string): boolean => {
    if (value.length < minLength) {
      addError(`${fieldName} deve ter pelo menos ${minLength} caracteres`);
      return false;
    }
    return true;
  };

  const validatePasswordMatch = (password: string, confirmPassword: string): boolean => {
    if (password !== confirmPassword) {
      addError('As senhas não coincidem');
      return false;
    }
    return true;
  };

  return {
    errors,
    success,
    addError,
    setError,
    clearErrors,
    setSuccessMessage,
    clearAll,
    validateEmail,
    validateRequired,
    validateMinLength,
    validatePasswordMatch
  };
};
