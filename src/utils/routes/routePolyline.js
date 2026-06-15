function decodePolyline(encodedPolyline) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encodedPolyline.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0;
    shift = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

export function decodeEncodedPolyline(encodedPolyline) {
  if (!encodedPolyline || typeof encodedPolyline !== 'string') return [];

  try {
    return decodePolyline(encodedPolyline);
  } catch {
    return [];
  }
}

export function hasUsablePolyline(route) {
  return Array.isArray(route?.latLngs) && route.latLngs.length >= 2;
}
