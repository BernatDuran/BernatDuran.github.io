export function renderPlaceDetailModal({
  place,
  category,
  priority,
  scoreText,
  plannerChipHtml,
  requiresTicketHtml = '',
  rainyToggleHtml = '',
  mapsLinkHtml = '',
  googleMapsUrl = '',
  timeIcon = '',
  bestTimeLabel = '',
  closeButtonId = 'modal-close',
  editButtonId = 'edit-place-btn',
  showEditButton = true,
  mapContainerId = '',
  commentLabel = 'Comentarios'
}) {
  return `<div class="modal-scroll">
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div>
        <h2 style="margin-bottom:4px;">${place.name}</h2>
        <div class="place-card-category" style="margin:0;"><span class="icon">${category?.icon || '&#x1F4CD;'}</span> ${place.type}</div>
      </div>
      <button class="modal-close" id="${closeButtonId}">&#x2715;</button>
    </div>
    <div class="modal-body">
      <div class="modal-toolbar">
        <div class="modal-toolbar-row">
          <div class="modal-badges modal-badges-inline">
            ${plannerChipHtml}
            <span class="priority-badge ${priority?.class || ''}">${priority?.icon || ''} ${priority?.label || ''}</span>
            ${requiresTicketHtml}
            ${rainyToggleHtml}
            ${mapsLinkHtml || (googleMapsUrl ? `<a href="${googleMapsUrl}" target="_blank" title="Abrir en Google Maps" class="modal-inline-icon-btn">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </a>` : '')}
          </div>
          ${showEditButton ? `<button type="button" id="${editButtonId}" class="filter-pill modal-edit-btn" style="border:1px solid var(--border); background:var(--bg-secondary);">&#x270F;&#xFE0F; Editar actividad</button>` : ''}
        </div>
      </div>
      <div class="modal-section"><div class="modal-section-title">Descripci&oacute;n</div><p style="line-height:1.7;">${place.description}</p></div>
      ${place.tips ? `<div class="modal-section"><div class="modal-section-title">Consejos pr&aacute;cticos</div><div class="modal-tip">${place.tips}</div></div>` : ''}
      ${place.comment ? `<div class="modal-section"><div class="modal-section-title">${commentLabel}</div><div class="modal-comment">${place.comment}</div></div>` : ''}
      <div class="modal-section"><div class="modal-section-title">Informaci&oacute;n &uacute;til</div>
      <div class="modal-info-grid">
        <div class="modal-info-item"><span class="modal-info-label">&#x1F4CD; Zona</span><span class="modal-info-value">${place.zone || 'Pendiente'}</span></div>
        <div class="modal-info-item"><span class="modal-info-label">${category?.icon || '&#x1F4CC;'} Categor&iacute;a</span><span class="modal-info-value">${category?.label || 'Pendiente'}</span></div>
        <div class="modal-info-item"><span class="modal-info-label">&#x23F1;&#xFE0F; Duraci&oacute;n estimada</span><span class="modal-info-value">${place.estimatedDuration || 'Pendiente'}</span></div>
        <div class="modal-info-item"><span class="modal-info-label">${timeIcon} Mejor momento</span><span class="modal-info-value">${bestTimeLabel}</span></div>
        ${scoreText ? `<div class="modal-info-item"><span class="modal-info-label">&#x2B50; Puntuaci&oacute;n</span><span class="modal-info-value">${scoreText}</span></div>` : ''}
        ${place.ticketInfo ? `<div class="modal-info-item"><span class="modal-info-label">&#x1F3AB; Entrada</span><span class="modal-info-value">${place.ticketInfo}</span></div>` : ''}
      </div></div>
      ${place.address ? `<div class="modal-section"><div class="modal-section-title">Direcci&oacute;n</div><div class="modal-address">${googleMapsUrl ? `<a href="${googleMapsUrl}" target="_blank" class="address-link">${place.address}</a>` : place.address}</div></div>` : ''}
      ${mapContainerId ? `<div id="${mapContainerId}" class="modal-map"></div>` : ''}
    </div>
  </div>`;
}
