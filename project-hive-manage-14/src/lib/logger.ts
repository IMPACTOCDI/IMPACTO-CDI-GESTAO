import { toast } from 'sonner';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  showToast?: boolean;
  toastDuration?: number;
  context?: string;
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, context?: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const levelStr = `[${level.toUpperCase()}]`;
    return `${timestamp} ${levelStr} ${contextStr} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any, options: LogOptions = {}) {
    const { showToast = false, toastDuration = 3000, context } = options;
    const formattedMessage = this.formatMessage(level, message, context);

    // Em produção, só mostrar erros e warnings
    if (!this.isDevelopment && (level === 'debug' || level === 'info')) {
      return;
    }

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '');
        break;
    }

    if (showToast) {
      if (level === 'error') {
        toast.error(message, { duration: toastDuration });
      } else if (level === 'warn') {
        toast.warning(message, { duration: toastDuration });
      } else if (level === 'info') {
        toast.success(message, { duration: toastDuration });
      }
    }
  }

  public debug(message: string, data?: any, options?: LogOptions) {
    this.log('debug', message, data, options);
  }

  public info(message: string, data?: any, options?: LogOptions) {
    this.log('info', message, data, options);
  }

  public warn(message: string, data?: any, options?: LogOptions) {
    this.log('warn', message, data, options);
  }

  public error(message: string, data?: any, options?: LogOptions) {
    this.log('error', message, data, options);
  }
}

export const logger = Logger.getInstance(); 