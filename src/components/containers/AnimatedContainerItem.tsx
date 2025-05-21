// src/components/containers/AnimatedContainerItem.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Card, useTheme } from '@mui/material';

// Animation variants for container items - improved for more pronounced staggering
const containerItemVariants = {
    hidden: (i: number) => ({
        opacity: 0,
        y: 20,
        scale: 0.97,
        // No delay in hidden state to prevent interference with exit animations
    }),
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            // Removed individual index delay as staggerChildren in parent handles timing
            type: "spring",
            damping: 20,
            stiffness: 100,
            duration: 0.5
        }
    }),
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 10,
        transition: {
            duration: 0.3,
            ease: "easeInOut"
        }
    }
};

interface AnimatedContainerItemProps {
    index: number;
    children: React.ReactNode;
}

const AnimatedContainerItem: React.FC<AnimatedContainerItemProps> = ({ index, children }) => {
    const theme = useTheme();

    return (
        <motion.div
            custom={index}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerItemVariants}
            whileHover={{
                scale: 1.005,
                y: -1,
                boxShadow: theme.palette.mode === 'dark'
                    ? '0 6px 15px rgba(0, 0, 0, 0.25)'
                    : '0 6px 15px rgba(100, 100, 140, 0.12)',
                transition: {
                    type: 'spring',
                    stiffness: 400,
                    damping: 25
                }
            }}
            whileTap={{
                scale: 0.98,
                transition: {
                    type: 'spring',
                    stiffness: 500,
                    damping: 30
                }
            }}
            style={{
                borderRadius: '16px',
                overflow: 'visible',
                transform: 'translateZ(0)', // Force GPU acceleration
                marginBottom: 16
            }}
        >
            <Card
                sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.shadows[2],
                    transition: 'all 0.3s ease',
                    height: '100%',
                    '&:hover': {
                        boxShadow: theme.shadows[8],
                    }
                }}
            >
                {children}
            </Card>
        </motion.div>
    );
};

export default AnimatedContainerItem;