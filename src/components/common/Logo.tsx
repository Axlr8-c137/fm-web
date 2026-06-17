import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import ratnamLogo from '../../assets/ratnam.png';

interface LogoProps {
  size?: number;
  showText?: boolean;
  textPosition?: 'bottom' | 'right';
  hoverEffect?: boolean;
  onClick?: () => void;
  textColor?: string;
  subTextColor?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 60,
  showText = false,
  textPosition = 'bottom',
  hoverEffect = true,
  onClick,
  textColor,
  subTextColor,
}) => {
  const isRow = textPosition === 'right';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        flexDirection: isRow ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isRow ? 2 : 1,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0c342b 0%, #175346 100%)',
          border: `2px solid #CCA43B`,
          boxShadow: (theme) => `0 4px 12px ${alpha('#0c342b', 0.25)}, inset 0 2px 4px rgba(255, 255, 255, 0.25)`,
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          ...(hoverEffect && {
            '&:hover': {
              transform: 'scale(1.06) rotate(3deg)',
              boxShadow: (theme) => `0 8px 20px ${alpha('#0c342b', 0.35)}, inset 0 2px 4px rgba(255, 255, 255, 0.35)`,
              borderColor: '#e5c158',
            },
          }),
        }}
      >
        <Box
          component="img"
          src={ratnamLogo}
          alt="Ratnamohan Logo"
          sx={{
            width: '82%',
            height: '82%',
            objectFit: 'contain',
            filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.15))',
          }}
        />
      </Box>

      {showText && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isRow ? 'flex-start' : 'center', textAlign: isRow ? 'left' : 'center' }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: size > 80 ? '1.5rem' : size > 50 ? '1.15rem' : '0.95rem',
              color: textColor || '#0c342b',
              letterSpacing: '0.75px',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}
          >
            RATNAMOHAN
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: subTextColor || '#9a7d23',
              fontWeight: 700,
              fontSize: size > 80 ? '0.75rem' : '0.625rem',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              mt: 0.25,
            }}
          >
            Facility Management
          </Typography>
        </Box>
      )}
    </Box>
  );
};
