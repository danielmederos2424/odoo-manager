// src/components/screens/ErrorScreen.tsx
import React from 'react';
import { Box, Button, Container, Paper } from '@mui/material';
import { useNavigate, useRouteError } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import TranslatedText from '../shared/TranslatedText';

const ErrorScreen: React.FC = () => {
    const error = useRouteError() as any;
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ width: '100%' }}
            >
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                    <TranslatedText 
                        variant="h4" 
                        component="h1" 
                        gutterBottom 
                        color="error"
                        i18nKey="errorTitle"
                    />

                    <TranslatedText 
                        variant="h6" 
                        sx={{ mb: 3 }}
                        i18nKey={error?.statusText || error?.message ? "" : "unexpectedError"}
                    >
                        {error?.statusText || error?.message || t("unexpectedError")}
                    </TranslatedText>

                    <TranslatedText 
                        variant="body1" 
                        sx={{ mb: 4 }}
                        i18nKey="errorDescription"
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => navigate('/')}
                        >
                            {t('goToHome')}
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={() => window.location.reload()}
                        >
                            {t('reloadPage')}
                        </Button>
                    </Box>
                </Paper>
            </motion.div>
        </Container>
    );
};

export default ErrorScreen;
