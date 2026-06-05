import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  alpha,
  useTheme,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  LocationOn as LocationIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  MyLocation as GpsIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths (broken by Vite bundling)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createPinIcon = (color: string) => {
  const svg = `
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <filter id="ps"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.28)"/></filter>
      <ellipse cx="18" cy="42" rx="6" ry="2.2" fill="rgba(0,0,0,0.15)"/>
      <path d="M18 2C10.268 2 4 8.268 4 16C4 26 18 40 18 40C18 40 32 26 32 16C32 8.268 25.732 2 18 2Z"
            fill="${color}" stroke="white" stroke-width="2.5" filter="url(#ps)"/>
      <circle cx="18" cy="16" r="6.5" fill="white" fill-opacity="0.92"/>
      <circle cx="18" cy="16" r="3.8" fill="${color}"/>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [36, 44], iconAnchor: [18, 44] });
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface LocationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

// Handles map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// Smoothly flies map to new center whenever coordinates change
function FlyToCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat: 0, lng: 0 });
  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.7 });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

// Fixes tile rendering inside a dialog (container size was 0 at mount)
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export const GoogleMapPickerModal: React.FC<LocationPickerModalProps> = ({
  open,
  onClose,
  onSelectLocation,
  initialLat,
  initialLng,
  initialAddress = '',
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const DEFAULT_LAT = 20.5937;
  const DEFAULT_LNG = 78.9629;

  const [markerLat, setMarkerLat] = useState(initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_LAT);
  const [markerLng, setMarkerLng] = useState(initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_LNG);
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on modal open
  useEffect(() => {
    if (open) {
      const lat = initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_LAT;
      const lng = initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_LNG;
      setMarkerLat(lat);
      setMarkerLng(lng);
      setSelectedAddress(initialAddress || '');
      setSearchQuery(initialAddress || '');
      setSearchResults([]);
      setGpsError(null);
      setSearchError(null);
      setIsMapReady(false);
      const t = setTimeout(() => setIsMapReady(true), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&email=admin@fmplatform.com`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await resp.json();
      if (data?.display_name) {
        setSelectedAddress(data.display_name);
        setSearchQuery(data.display_name);
      }
    } catch { /* coordinates still captured */ }
    finally { setIsReverseGeocoding(false); }
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMarkerLat(lat);
    setMarkerLng(lng);
    setSearchResults([]);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q || q.trim().length < 3) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}&email=admin@fmplatform.com`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data: NominatimResult[] = await resp.json();
        setSearchResults(data);
        if (data.length === 0) setSearchError('No locations found. Try a different search term.');
      } catch {
        setSearchError('Search failed. Please check your connection.');
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setMarkerLat(lat);
    setMarkerLng(lng);
    setSelectedAddress(result.display_name);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setSearchError(null);
  };

  const handleGpsLocate = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation is not supported by your browser.'); return; }
    setIsGettingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerLat(lat);
        setMarkerLng(lng);
        setIsGettingGps(false);
        reverseGeocode(lat, lng);
      },
      (err) => {
        setIsGettingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location permission denied. Please allow access in your browser settings.');
        } else {
          setGpsError('Unable to retrieve your location. Please try again or use search.');
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    onSelectLocation(markerLat, markerLng, selectedAddress);
    onClose();
  };

  const getShortName = (r: NominatimResult) => r.display_name.split(',')[0]?.trim() || r.display_name;
  const getSubtitle = (r: NominatimResult) => r.display_name.split(',').slice(1, 4).join(',').trim();

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = isDark
    ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>'
    : '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors';

  const pinIcon = createPinIcon(theme.palette.primary.main);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            backgroundImage: 'none',
            boxShadow: theme.shadows[16],
            overflow: 'hidden',
          }
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 2.5,
          pb: 2,
          px: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: isDark
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 60%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 60%)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 2.5, backgroundColor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main, display: 'flex' }}>
            <LocationIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Search &amp; Select Location
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Powered by OpenStreetMap · Free &amp; No API Key Required
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <Grid container sx={{ minHeight: { xs: 420, md: 520 } }}>

          {/* Left: Search panel */}
          <Grid
            size={{ xs: 12, md: 4 }}
            sx={{
              borderRight: { md: `1px solid ${theme.palette.divider}` },
              borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
              display: 'flex',
              flexDirection: 'column',
              maxHeight: { xs: 260, md: 520 },
            }}
          >
            <Box sx={{ p: 2, pb: 1.5 }}>
              <TextField
                fullWidth
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search address, city, landmark..."
                variant="outlined"
                size="small"
                autoComplete="off"
                slotProps={{
                  input: {
                    sx: { borderRadius: 3 },
                    startAdornment: (
                      <InputAdornment position="start">
                        {isSearching
                          ? <CircularProgress size={16} color="primary" />
                          : <SearchIcon fontSize="small" color="action" />}
                      </InputAdornment>
                    ),
                  }
                }}
              />
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={isGettingGps ? <CircularProgress size={14} /> : <GpsIcon fontSize="small" />}
                onClick={handleGpsLocate}
                disabled={isGettingGps}
                sx={{ mt: 1, borderRadius: 3, textTransform: 'none', fontWeight: 600, borderStyle: 'dashed' }}
              >
                {isGettingGps ? 'Getting GPS location...' : 'Use My Current Location'}
              </Button>
              {gpsError && <Alert severity="warning" sx={{ mt: 1, borderRadius: 2, py: 0.5, fontSize: '0.74rem' }}>{gpsError}</Alert>}
              {searchError && searchResults.length === 0 && !isSearching && (
                <Alert severity="info" sx={{ mt: 1, borderRadius: 2, py: 0.5, fontSize: '0.74rem' }}>{searchError}</Alert>
              )}
            </Box>

            {/* Results list */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1 }}>
              {searchResults.length > 0 && (
                <List dense disablePadding>
                  {searchResults.map((result) => (
                    <ListItemButton
                      key={result.place_id}
                      onClick={() => handleSelectResult(result)}
                      sx={{
                        borderRadius: 2.5, mb: 0.5, px: 1.5, py: 1,
                        border: `1px solid transparent`,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.06),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}><PlaceIcon fontSize="small" color="primary" /></ListItemIcon>
                      <ListItemText
                        primary={getShortName(result)}
                        secondary={getSubtitle(result)}
                        slotProps={{
                          primary: { sx: { fontWeight: 700, fontSize: '0.83rem', lineHeight: 1.3 } },
                          secondary: { sx: { fontSize: '0.71rem', lineHeight: 1.3, mt: 0.25 } },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
              {searchResults.length === 0 && !isSearching && searchQuery.length === 0 && (
                <Box sx={{ px: 1.5, py: 3, textAlign: 'center' }}>
                  <SearchIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.disabled" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
                    Type to search locations
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    or click anywhere on the map
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Right: Map */}
          <Grid
            size={{ xs: 12, md: 8 }}
            sx={{ position: 'relative', minHeight: { xs: 280, md: 520 } }}
          >
            {isMapReady && (
              <MapContainer
                center={[markerLat, markerLng]}
                zoom={markerLat === DEFAULT_LAT && markerLng === DEFAULT_LNG ? 5 : 15}
                style={{ height: '100%', width: '100%', minHeight: 280 }}
              >
                <TileLayer url={tileUrl} attribution={tileAttribution} />
                <MapClickHandler onMapClick={handleMapClick} />
                <FlyToCenter lat={markerLat} lng={markerLng} />
                <InvalidateSizeOnMount />
                <Marker
                  position={[markerLat, markerLng]}
                  icon={pinIcon}
                  draggable
                  eventHandlers={{
                    dragend(e) {
                      const latlng = (e.target as L.Marker).getLatLng();
                      setMarkerLat(latlng.lat);
                      setMarkerLng(latlng.lng);
                      reverseGeocode(latlng.lat, latlng.lng);
                    },
                  }}
                />
              </MapContainer>
            )}

            {/* Instruction pill overlay */}
            <Box sx={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1000, pointerEvents: 'none' }}>
              <Paper
                elevation={0}
                sx={{
                  px: 2, py: 1, borderRadius: 3,
                  backgroundColor: alpha(theme.palette.background.paper, 0.88),
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${theme.palette.divider}`,
                  display: 'flex', alignItems: 'center', gap: 1,
                  boxShadow: theme.shadows[4],
                }}
              >
                {isReverseGeocoding ? (
                  <><CircularProgress size={14} /><Typography variant="caption" sx={{ fontWeight: 600 }}>Resolving address...</Typography></>
                ) : (
                  <><LocationIcon fontSize="small" color="primary" /><Typography variant="caption" sx={{ fontWeight: 600 }}>Click on the map or drag the pin to set location</Typography></>
                )}
              </Paper>
            </Box>
          </Grid>
        </Grid>

        {/* Selected location summary */}
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Selected Location
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600, mt: 0.25,
                  color: selectedAddress ? 'text.primary' : 'text.disabled',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {selectedAddress || 'No location selected yet. Click the map or search above.'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Latitude</Typography>
              <Chip label={markerLat.toFixed(5)} size="small" variant="outlined" color="primary" sx={{ mt: 0.5, display: 'flex', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', width: 'fit-content' }} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Longitude</Typography>
              <Chip label={markerLng.toFixed(5)} size="small" variant="outlined" color="primary" sx={{ mt: 0.5, display: 'flex', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', width: 'fit-content' }} />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 3, px: 3 }}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={isReverseGeocoding || isGettingGps}
          startIcon={<CheckCircleIcon />}
          sx={{ borderRadius: 3, px: 4, fontWeight: 700 }}
        >
          Confirm Location
        </Button>
      </DialogActions>
    </Dialog>
  );
};
