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
            historialBody.innerHTML = '<tr><td colspan="5">No se encontraron alertas que coincidan con los filtros.</td></tr>';
            return;
        }

        historialBody.innerHTML = filteredAlerts.map(a => {
            const rowId = `desc-row-${a.id_alerta}`;
            return `
                <tr>
                    <td>#${a.id_alerta}</td>
                    <td>${a.tipo_alerta || '-'}</td>
                    <td>${a.nivel || '-'}</td>
                    <td>${formatDate(a.fecha_hora)}</td>
                    <td><button class="btn-link" onclick="toggleDescription('${rowId}')">Ver detalles</button></td>
                </tr>
                <tr id="${rowId}" class="description-row">
                    <td colspan="5">
                        <div class="description-cell">
                            <strong>Descripción:</strong> ${a.descripcion || 'Sin descripción detallada.'}
                        </div>
                    </td>
                </tr>
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

    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', loadAndFilterAlerts);
    }

    // Carga inicial
    loadAndFilterAlerts();
});
