import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/hooks/use-toast';

interface AvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatar || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione uma imagem.",
          variant: "destructive",
          className: "bg-destructive border-destructive text-destructive-foreground"
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB.",
          variant: "destructive",
          className: "bg-destructive border-destructive text-destructive-foreground"
        });
        return;
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!previewUrl || previewUrl === user?.avatar) {
      onClose();
      return;
    }

    setIsUploading(true);
    try {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update user avatar
      updateUser({ avatar: previewUrl });

      toast({
        title: "Avatar atualizado",
        description: "Sua foto de perfil foi alterada com sucesso.",
        className: "bg-card border-border text-foreground"
      });

      onClose();
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o avatar. Tente novamente.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    setIsUploading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateUser({ avatar: previewUrl || undefined });

      toast({
        title: "Avatar atualizado",
        description: previewUrl ? "Sua foto de perfil foi alterada com sucesso." : "Foto de perfil removida com sucesso.",
        className: "bg-card border-border text-foreground"
      });

      onClose();
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o avatar. Tente novamente.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-dark">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Editar Avatar</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-center space-y-4">
            <Avatar className="h-32 w-32 mx-auto border-4 border-border">
              <AvatarImage src={previewUrl || undefined} alt="Preview" />
              <AvatarFallback className="bg-muted text-muted-foreground text-4xl">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-border/50 text-foreground hover:bg-background/50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Imagem
              </Button>

              {previewUrl && (
                <Button
                  onClick={handleRemove}
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover Imagem
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-border/50 text-foreground hover:bg-background/50"
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 gradient-primary"
                disabled={isUploading}
              >
                {isUploading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvatarEditor;
