import { useState, ChangeEvent } from 'react';

interface FormErrors {
  [key: string]: string;
}

export const useAuthForm = <T extends Record<string, any>>(initialValues: T) => {
  const [formData, setFormData] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData(
      prev =>
        ({
          ...prev,
          [name]: value,
        } as T)
    );

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const resetForm = () => {
    setFormData(initialValues);
    setErrors({});
  };

  return {
    formData,
    setFormData,
    errors,
    isLoading,
    setErrors,
    setIsLoading,
    handleInputChange,
    resetForm,
  };
};
