import { useEffect } from 'react';

const SITE_NAME = '修仙问答';

/**
 * 设置页面标题，格式：页面名 - 修仙问答
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = SITE_NAME;
    };
  }, [title]);
}
