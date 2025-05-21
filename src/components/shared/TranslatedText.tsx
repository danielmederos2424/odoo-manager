import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, TypographyProps } from '@mui/material';

interface TranslatedTextProps extends Omit<TypographyProps, 'children'> {
  i18nKey: string;
}

/**
 * A component that displays translated text based on the current language
 */
const TranslatedText: React.FC<TranslatedTextProps> = ({ i18nKey, ...props }) => {
  const { t } = useTranslation();
  
  return (
    <Typography {...props}>
      {t(i18nKey)}
    </Typography>
  );
};

export default TranslatedText;