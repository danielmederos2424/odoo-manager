// src/components/layout/Footer.tsx
import React from 'react';
import { Box, Typography, Link, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

const Footer: React.FC = () => {
    const theme = useTheme();
    const { t } = useTranslation();

    const openWebGraphixSite = () => {
        if (window.require) {
            const { shell } = window.require('electron');
            shell.openExternal('https://www.webgraphix.online');
        } else {
            window.open('https://www.webgraphix.online', '_blank');
        }
    };

    return (
        <Box
            component="footer"
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                py: 1,
                px: 2,
                backgroundColor: 'transparent',
                backdropFilter: 'blur(10px)',
                borderTop: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                WebkitAppRegion: 'no-drag',
            }}
        >
            <Typography variant="caption" color="text.secondary">
                {t('madeBy')}{' '}
                <Link
                    component="button"
                    variant="caption"
                    color="primary"
                    sx={{
                        textDecoration: 'none',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'color 0.2s ease, transform 0.2s ease',
                        '&:hover': {
                            color: theme.palette.primary.main,
                            transform: 'translateY(-1px)',
                        },
                    }}
                    onClick={openWebGraphixSite}
                >
                    {t('companyName')}
                </Link>
            </Typography>
        </Box>
    );
};

export default Footer;
