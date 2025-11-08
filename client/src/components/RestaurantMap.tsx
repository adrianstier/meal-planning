import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import type { Restaurant } from '../types/api';
import { MapPin, Phone, Globe, Star } from 'lucide-react';
import { Badge } from './ui/badge';

interface RestaurantMapProps {
  restaurants: Restaurant[];
  height?: string;
}

// Fix for default marker icon in react-leaflet
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const RestaurantMap: React.FC<RestaurantMapProps> = ({ restaurants, height = '500px' }) => {
  // Filter restaurants that have coordinates
  const restaurantsWithCoords = useMemo(
    () => restaurants.filter((r) => r.latitude && r.longitude),
    [restaurants]
  );

  // Calculate center of map based on average coordinates
  const center = useMemo(() => {
    if (restaurantsWithCoords.length === 0) {
      // Default to San Francisco if no restaurants with coords
      return { lat: 37.7749, lng: -122.4194 };
    }
    const avgLat =
      restaurantsWithCoords.reduce((sum, r) => sum + (r.latitude || 0), 0) /
      restaurantsWithCoords.length;
    const avgLng =
      restaurantsWithCoords.reduce((sum, r) => sum + (r.longitude || 0), 0) /
      restaurantsWithCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [restaurantsWithCoords]);

  if (restaurantsWithCoords.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No restaurants with location data yet.</p>
          <p className="text-sm">Add addresses and use "Get Coords" to see them on the map!</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height, width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {restaurantsWithCoords.map((restaurant) => (
        <Marker
          key={restaurant.id}
          position={[restaurant.latitude!, restaurant.longitude!]}
          icon={defaultIcon}
        >
          <Popup maxWidth={300}>
            <div className="space-y-2 p-2">
              <div>
                <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                {restaurant.cuisine_type && (
                  <Badge variant="secondary" className="mt-1">
                    {restaurant.cuisine_type}
                  </Badge>
                )}
              </div>

              {restaurant.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
              )}

              {restaurant.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{restaurant.phone}</span>
                </div>
              )}

              {restaurant.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}

              {restaurant.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{restaurant.rating}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1 mt-2">
                {restaurant.price_range && (
                  <Badge variant="outline" className="text-xs">
                    {restaurant.price_range}
                  </Badge>
                )}
                {restaurant.outdoor_seating && (
                  <Badge variant="outline" className="text-xs">Outdoor</Badge>
                )}
                {restaurant.has_bar && (
                  <Badge variant="outline" className="text-xs">Bar</Badge>
                )}
                {restaurant.kid_friendly && (
                  <Badge variant="outline" className="text-xs">Kid Friendly</Badge>
                )}
              </div>

              {restaurant.notes && (
                <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                  {restaurant.notes}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default RestaurantMap;
