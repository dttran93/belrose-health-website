import React from 'react';

const Badge = ({ 
  children, 
  variant = "default", 
  size = "default",
  className = "",
  ...props 
}) => {
  const baseClasses = "inline-flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-primary hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-primary hover:bg-destructive/80",
    outline: "text-primary border border-border bg-background hover:bg-accent hover:text-accent-primary",
    success: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
    warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    info: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
  };

  const sizes = {
    default: "px-2.5 py-0.5 text-xs rounded-full",
    sm: "px-2 py-0.5 text-xs rounded-md",
    lg: "px-3 py-1 text-sm rounded-md",
  };

  const variantClass = variants[variant] || variants.default;
  const sizeClass = sizes[size] || sizes.default;

  return (
    <div 
      className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export { Badge };