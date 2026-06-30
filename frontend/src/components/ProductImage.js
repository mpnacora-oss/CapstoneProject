"use client";

import React, { useState, useEffect } from "react";
import { Package, ImageOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export function resolveProductImageUrl(product) {
  if (!product) return null;

  const rawPath =
    product.thumbnail_url ||
    product.image_url ||
    product.image ||
    product.product_image ||
    null;

  if (!rawPath) return null;

  if (rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("data:")) {
    return rawPath;
  }

  const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const baseHost = (API_BASE_URL && API_BASE_URL.length > 0) 
    ? API_BASE_URL.replace(/\/$/, "") 
    : "http://localhost:5000";

  return `${baseHost}${cleanPath}`;
}

export default function ProductImage({
  product,
  alt = "Product Image",
  className = "w-full h-full object-contain p-2",
  containerClassName = "w-full h-full relative flex items-center justify-center bg-brand-panel overflow-hidden",
  showPlaceholderText = true,
  onClick
}) {
  const [src, setSrc] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const url = resolveProductImageUrl(product);
    setSrc(url);
    setHasError(false);
    setIsLoading(!!url);
  }, [product?.id, product?.image_url, product?.product_image, product?.thumbnail_url, product?.image]);

  if (!src || hasError) {
    return (
      <div 
        onClick={onClick}
        className={`${containerClassName} select-none`}
      >
        <div className="flex flex-col items-center justify-center text-brand-muted/40 p-3 text-center">
          <Package className="w-8 h-8 stroke-[1.5] mb-1 opacity-60" />
          {showPlaceholderText && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted/50">
              No Image
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={containerClassName}>
      {isLoading && (
        <div className="absolute inset-0 bg-brand-panel animate-pulse flex items-center justify-center z-0">
          <Package className="w-6 h-6 text-brand-muted/20 animate-bounce" />
        </div>
      )}
      <img
        src={src}
        alt={product?.name || alt}
        className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} relative z-10`}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}
