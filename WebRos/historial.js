'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const historialBody = document.getElementById('historialBody');
    const filterNivel = document.getElementById('filterNivel');
    const filterFechaInicio = document.getElementById('filterFechaInicio');
    const filterFechaFin = document.getElementById('filterFechaFin');
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    const dbUserNameIcon = document.getElementById('dbUserNameIcon');

    let allAlerts = [];

    function formatDate(value) {
        if (!value) return '-';
        try { return new Date(value).toLocaleString('es-ES'); }
        catch { return value; }
    }

    function isDateInRange(dateString, startDateStr, endDateStr) {
        if (!startDateStr && !endDateStr) return true;
        
        const date = new Date(dateString);
        // Reset time for accurate date comparison
        date.setHours(0, 0, 0, 0);

        if (startDateStr) {
            const start = new Date(startDateStr);
            start.setHours(0, 0, 0, 0);
            if (date < start) return false;
        }
        
        if (endDateStr) {
            const end = new Date(endDateStr);
            end.setHours(23, 59, 59, 999);
            if (date > end) return false;
        }

        return true;
    }

    function renderHistorial(filteredAlerts) {
        if (!historialBody) return;

        if (filteredAlerts.length === 0) {
            historialBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No se encontraron alertas que coincidan con los filtros.</td></tr>';
            return;
        }

        historialBody.innerHTML = filteredAlerts.map(a => {
            const rowId = `desc-row-${a.id_alerta}`;
            const isImage = a.tipo_alerta && a.tipo_alerta.toLowerCase() === 'imagen';
            
            let actionHtml;
            if (isImage) {
                // Escapamos comillas simples en las cadenas para evitar problemas al inyectarlas en el evento onclick
                const imgPath = (a.ruta_imagen || '').replace(/'/g, "\\'");
                const desc = (a.descripcion || '').replace(/'/g, "\\'");
                actionHtml = `<button class="btn-link" onclick="openImageModal('${imgPath}', '${desc}')">Ver captura</button>`;
            } else {
                actionHtml = `<button class="btn-link" onclick="toggleDescription('${rowId}')">Ver detalles</button>`;
            }

            return `
                <tr>
                    <td>#${a.id_alerta}</td>
                    <td>${a.tipo_alerta || '-'}</td>
                    <td><span style="color: ${a.nivel === 'Alta' ? 'var(--danger-color)' : (a.nivel === 'Media' ? 'var(--warning-color)' : 'var(--success-color)')}; font-weight: 600;">${a.nivel || '-'}</span></td>
                    <td>${formatDate(a.fecha_hora)}</td>
                    <td>${actionHtml}</td>
                </tr>
                ${!isImage ? `
                <tr id="${rowId}" class="description-row">
                    <td colspan="5">
                        <div class="description-cell">
                            <strong>Descripción:</strong> ${a.descripcion || 'Sin descripción detallada.'}
                        </div>
                    </td>
                </tr>
                ` : ''}
            `;
        }).join('');
    }

    function loadAndFilterAlerts() {
        if (!window.VelarisDB) return;
        
        const data = window.VelarisDB.getDataForCurrentUser();
        if (!data.user) {
            window.location.href = 'login.html';
            return;
        }

        if (dbUserNameIcon) {
            const nombre = data.user.nombre || 'U';
            dbUserNameIcon.textContent = nombre.charAt(0).toUpperCase();
        }

        // Obtener solo resueltas y ordenar de más reciente a más antigua
        allAlerts = data.alertas
            .filter(a => a.estado_alerta === 'resuelta')
            .sort((a, b) => b.id_alerta - a.id_alerta);

        const nivel = filterNivel.value;
        const start = filterFechaInicio.value;
        const end = filterFechaFin.value;

        const filtered = allAlerts.filter(a => {
            const matchNivel = (nivel === 'todos') || (a.nivel && a.nivel.toLowerCase() === nivel.toLowerCase());
            const matchFecha = isDateInRange(a.fecha_hora, start, end);
            return matchNivel && matchFecha;
        });

        renderHistorial(filtered);
    }

    window.toggleDescription = function(rowId) {
        const row = document.getElementById(rowId);
        if (row) {
            row.classList.toggle('active');
        }
    };

    window.openImageModal = function(imagePath, description) {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('modalImage');
        const desc = document.getElementById('modalDescription');
        
        if (modal && img && desc) {
            // Usa placeholder si no hay ruta válida
            const fallbackPath = 'assets/deteccion_opencv_placeholder.jpg';
            img.src = imagePath || fallbackPath;
            
            // Fallback al placeholder si la imagen falla al cargar
            img.onerror = function() {
                this.src = fallbackPath;
                this.onerror = null; // Evitar loop infinito si el placeholder tampoco existe
            };
            
            desc.innerHTML = `<strong>Descripción de alerta:</strong><br>${description || 'Sin descripción detallada.'}`;
            modal.classList.add('active');
        }
    };

    const closeModalBtn = document.getElementById('closeModalBtn');
    const imageModal = document.getElementById('imageModal');
    
    if (closeModalBtn && imageModal) {
        closeModalBtn.addEventListener('click', () => {
            imageModal.classList.remove('active');
        });
        
        // Cerrar al hacer clic en el overlay (fuera del contenido)
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.classList.remove('active');
            }
        });
    }

    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', loadAndFilterAlerts);
    }

    // Carga inicial
    loadAndFilterAlerts();
});
