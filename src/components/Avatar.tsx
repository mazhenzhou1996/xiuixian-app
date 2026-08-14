import { useState } from 'react';

interface AvatarProps {
  /** 头像 URL；为空或加载失败时显示昵称首字兜底 */
  src?: string;
  alt?: string;
  /** 头像尺寸类（w-* h-*），默认 w-9 h-9 */
  className?: string;
  /** 文字兜底的背景色，默认蓝色系 */
  bgClass?: string;
}

/**
 * 通用头像组件：空 URL / 加载失败时自动降级为「首字圆形」，
 * 避免出现破图图标。
 */
export default function Avatar({ src, alt = '', className = 'w-9 h-9', bgClass = 'bg-blue-600' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;
  const initial = (alt || '道').trim().charAt(0);

  if (showFallback) {
    return (
      <div
        className={`${className} ${bgClass} rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 select-none`}
        aria-label={alt}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover shrink-0`}
    />
  );
}
