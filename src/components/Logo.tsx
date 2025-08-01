import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo = ({ className = "", size = 60 }: LogoProps) => {
  const height = 60;
  const width = height * (65.78 / 19.13); // maintain aspect ratio (width/height from viewBox)
  
  return (
    <svg 
      width={width} 
      height={height}
      viewBox="0 0 65.78 19.13" 
      className={className}
      fill="currentColor"
    >
      <path d="M14.21.22v7.96c0,.12-.1.22-.22.22h-2.15c-.12,0-.22-.1-.22-.22V3.7c0-.18-.21-.28-.35-.17l-3.99,3.16c-.08.06-.19.06-.27,0L2.93,3.5c-.14-.11-.35,0-.35.17v4.51c0,.12-.1.22-.22.22H.22c-.12,0-.22-.1-.22-.22V.22c0-.12.1-.22.22-.22h2.29s.09.02.13.04l4.39,3.34c.08.06.19.06.26,0L11.58.05s.09-.05.13-.05h2.29c.12,0,.22.1.22.22Z"/>
      <path d="M27.4,8.4h-11.77c-.12,0-.22-.1-.22-.22V.22c0-.12.1-.22.22-.22h11.77c.12,0,.22.1.22.22v7.96c0,.12-.1.22-.22.22ZM24.98,5.86v-3.35c0-.12-.1-.22-.22-.22h-6.49c-.12,0-.22.1-.22.22v3.35c0,.12.1.22.22.22h6.49c.12,0,.22-.1.22-.22Z"/>
      <path d="M40.65.3l-3.53,7.96c-.03.08-.11.13-.2.13h-4.88v-.06L28.48.3c-.06-.14.04-.3.2-.3h2.34c.09,0,.16.05.2.13l2.5,5.82c.03.08.11.13.2.13h1.27c.09,0,.16-.05.2-.13L37.88.13c.03-.08.11-.13.2-.13h2.37c.16,0,.26.16.2.3Z"/>
      <path d="M48.54,2.53v3.33c0,.12.1.22.22.22h3.97c.12,0,.22.1.22.22v1.88c0,.12-.1.22-.22.22h-11c-.12,0-.22-.1-.22-.22v-1.88c0-.12.1-.22.22-.22h3.96c.12,0,.22-.1.22-.22v-3.33c0-.12-.1-.22-.22-.22h-3.96c-.12,0-.22-.1-.22-.22V.22c0-.12.1-.22.22-.22h11c.12,0,.22.1.22.22v1.88c0,.12-.1.22-.22.22h-3.97c-.12,0-.22.1-.22.22Z"/>
      <path d="M56.78,2.28v.84h7.96c.12,0,.22.1.22.22v1.75c0,.12-.1.22-.22.22h-7.96v.82h8.78c.12,0,.22.1.22.22v1.85c0,.12-.1.22-.22.22h-11.2c-.12,0-.22-.1-.22-.22V.22c0-.12.1-.22.22-.22h11.2c.12,0,.22.1.22.22v1.85c0,.12-.1.22-.22.22h-8.78Z"/>
      <path d="M14.21,14.93c0,2.59-1.99,4.2-4.62,4.2H.22c-.12,0-.22-.1-.22-.22v-7.96c0-.12.1-.22.22-.22h9.38c2.63,0,4.62,1.6,4.62,4.2ZM11.53,14.93c0-1.08-.82-1.9-1.93-1.9H2.84c-.12,0-.22.1-.22.22v3.36c0,.12.1.22.22.22h6.75c1.12-.02,1.93-.83,1.93-1.9Z"/>
      <path d="M29.84,10.89c-.03-.09-.11-.16-.21-.16h-4.46c-.1,0-.18.07-.21.16l-2.03,7.69-1.18-1.79c-.06-.1-.04-.22.06-.29.81-.59,1.27-1.51,1.27-2.53,0-1.79-1.42-3.24-3.56-3.24h-4.35c-.12,0-.22.1-.22.22v7.96c0,.12.1.22.22.22h2.22c.12,0,.22-.1.22-.22v-1.49c0-.12.1-.22.22-.22h1.16c.08,0,.15.04.19.11l1.01,1.71c.04.07.11.11.19.11h4.92c.1,0,.18-.07.21-.16l.26-1.01c.02-.1.11-.16.21-.16h2.87c.1,0,.18.07.21.16l.26,1.01c.02.1.11.16.21.16h2.23c.14,0,.25-.13.21-.27l-2.1-7.96ZM19.51,14.89h-1.7c-.12,0-.22-.1-.22-.22v-1.41c0-.12.1-.22.22-.22h1.7c.5,0,.92.41.92.92s-.42.92-.92.92ZM28.11,15.46h-1.43c-.14,0-.24-.13-.21-.27l.55-2.14h.74l.55,2.14c.04.14-.07.27-.21.27Z"/>
      <path d="M48.41,10.73h-15.48c-.12,0-.22.1-.22.22v7.96c0,.12.1.22.22.22h2.21c.12,0,.22-.1.22-.22v-2.25c0-.12.1-.22.22-.22h5.6c.12,0,.22-.1.22-.22v-1.85c0-.12-.1-.22-.22-.22h-5.81v-1.12h7.63c.12,0,.22.1.22.22v5.65c0,.12.1.22.22.22h2.21c.12,0,.22-.1.22-.22v-5.65c0-.12.1-.22.22-.22h2.36c.12,0,.22-.1.22-.22v-1.88c0-.12-.1-.22-.22-.22Z"/>
      <path d="M52.2,13.01v.84h3.17c.12,0,.22.1.22.22v1.75c0,.12-.1.22-.22.22h-3.17v.8h3.98c.12,0,.22.1.22.22v1.86c0,.12-.1.22-.22.22h-6.4c-.12,0-.22-.1-.22-.22v-7.96c0-.12.1-.22.22-.22h6.4c.12,0,.22.1.22.22v1.85c0,.12-.1.22-.22.22h-3.98Z"/>
      <path d="M57.47,10.95c0-.12.1-.22.22-.22h4.35c2.15,0,3.56,1.45,3.56,3.24,0,1.02-.46,1.94-1.27,2.53-.09.07-.12.19-.06.29l1.32,2c.09.14,0,.34-.18.34h-2.53c-.08,0-.15-.04-.19-.11l-1.01-1.71c-.04-.07-.11-.11-.19-.11h-1.16c-.12,0-.22.1-.22.22v1.49c0,.12-.1.22-.22.22h-2.22c-.12,0-.22-.1-.22-.22v-7.96ZM62.04,14.89c.5,0,.92-.41.92-.92s-.42-.92-.92-.92h-1.7c-.12,0-.22.1-.22.22v1.41c0,.12.1.22.22.22h1.7Z"/>
    </svg>
  );
};

export default Logo;