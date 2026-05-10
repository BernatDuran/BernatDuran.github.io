export function createControlButton(config = {}) {
  const button = L.DomUtil.create('button', `travel-map-control-btn ${config.className || ''}`.trim());
  button.type = 'button';
  button.innerHTML = config.icon || '';
  button.title = config.title || '';
  button.setAttribute('aria-label', config.ariaLabel || config.title || 'Control de mapa');
  if (config.disabled) button.disabled = true;
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.on(button, 'click', (event) => {
    L.DomEvent.stop(event);
    config.onClick?.(event);
  });
  return button;
}

function toggleFullscreen(map, container) {
  const shell = container.closest('.travel-map-shell, .city-map-section, .modal-map') || container;
  const finish = () => setTimeout(() => map.invalidateSize({ pan: false }), 220);

  if (document.fullscreenElement) {
    document.exitFullscreen?.().finally(finish);
    return;
  }

  if (shell.requestFullscreen) {
    shell.requestFullscreen().finally(finish);
    return;
  }

  shell.classList.toggle('travel-map-fullscreen');
  finish();
}

export function addTravelMapControls(map, options = {}) {
  if (!map || map.__travelControlsAdded) return null;

  const TravelControl = L.Control.extend({
    options: { position: options.position || 'topright' },
    onAdd() {
      const wrapper = L.DomUtil.create('div', `travel-map-controls ${options.className || ''}`.trim());
      const group = L.DomUtil.create('div', 'travel-map-control-group', wrapper);
      const container = map.getContainer();

      if (options.showZoom !== false) {
        group.appendChild(createControlButton({ icon: '+', title: 'Acercar', onClick: () => map.zoomIn() }));
        group.appendChild(createControlButton({ icon: '&minus;', title: 'Alejar', onClick: () => map.zoomOut() }));
      }
      if (options.showFitBounds !== false) {
        group.appendChild(createControlButton({ icon: '&#x25CE;', title: 'Centrar resultados', onClick: () => options.onFitBounds?.() }));
      }
      if (options.showLocate !== false) {
        group.appendChild(createControlButton({ icon: '&#x2316;', title: 'Localizarme', onClick: () => options.onLocate?.() }));
      }
      if (options.showFullscreen !== false) {
        group.appendChild(createControlButton({ icon: '&#x26F6;', title: 'Pantalla completa', onClick: () => toggleFullscreen(map, container) }));
      }

      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.disableClickPropagation(wrapper);
      return wrapper;
    }
  });

  const control = new TravelControl();
  control.addTo(map);
  map.__travelControlsAdded = true;
  return control;
}
