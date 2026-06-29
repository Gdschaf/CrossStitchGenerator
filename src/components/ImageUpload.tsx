import React, { useRef } from 'react';
import './ImageUpload.css';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/'))) {
      onImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className={`image-upload${className ? ` ${className}` : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="upload-area">
        <p>Drag and drop an image here, or</p>
        <button onClick={() => fileInputRef.current?.click()}>
          Browse Files
        </button>
        <p className="upload-hint">Supports PNG (transparency) and JPEG</p>
      </div>
    </div>
  );
};
