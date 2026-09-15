import { useState, type JSX } from 'react';
import Image from 'next/image';
import cn from 'clsx';
import { publicAsset } from '@lib/assets';
import type { ReactNode } from 'react';
import type { ImageProps } from 'next/image';

type NextImageProps = {
  alt: string;
  width?: string | number;
  children?: ReactNode;
  useSkeleton?: boolean;
  imgClassName?: string;
  previewCount?: number;
  blurClassName?: string;
} & ImageProps;

/**
 *
 * @description Must set width and height, if not add fill
 * @param useSkeleton add background with pulse animation, don't use it if image is transparent
 */
export function NextImage({
  src,
  alt,
  width,
  height,
  children,
  className,
  useSkeleton,
  imgClassName,
  previewCount,
  blurClassName,
  fill,
  style,
  onLoad,
  ...rest
}: NextImageProps): JSX.Element {
  const [loading, setLoading] = useState(!!useSkeleton);
  const imageSrc = typeof src === 'string' ? publicAsset(src) : src;

  const handleLoad: NonNullable<ImageProps['onLoad']> = (event) => {
    setLoading(false);
    onLoad?.(event);
  };

  return (
    <figure style={{ width }} className={className}>
      <Image
        className={cn(
          imgClassName,
          loading
            ? (blurClassName ??
                'animate-pulse bg-light-secondary dark:bg-dark-secondary')
            : previewCount === 1
              ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
              : 'object-cover'
        )}
        src={imageSrc}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        style={
          fill
            ? style
            : {
                width: '100%',
                height: 'auto',
                aspectRatio:
                  width && height ? `${width} / ${height}` : undefined,
                ...style
              }
        }
        alt={alt}
        onLoad={handleLoad}
        {...rest}
      />
      {children}
    </figure>
  );
}
