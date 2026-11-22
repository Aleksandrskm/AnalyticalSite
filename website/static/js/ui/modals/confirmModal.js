'use strict';

export function showConfirmModal({ title = 'Подтверждение', message = 'Вы уверены?', yesText = 'Да', noText = 'Нет' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';

        const t = document.createElement('div'); t.className = 'confirm-modal__title'; t.textContent = title;
        const m = document.createElement('div'); m.className = 'confirm-modal__message'; m.textContent = message;
        const actions = document.createElement('div'); actions.className = 'confirm-modal__actions';

        const yes = document.createElement('button');
        yes.type = 'button'; yes.className = 'confirm-modal__btn confirm-modal__btn--yes'; yes.textContent = yesText;
        const no = document.createElement('button');
        no.type = 'button'; no.className = 'confirm-modal__btn confirm-modal__btn--no'; no.textContent = noText;

        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            overlay.classList.add('confirm-modal-overlay--closing');
            setTimeout(() => { overlay.remove(); resolve(result); }, 160);
        };
        function onKey(e) { if (e.key === 'Escape') close(false); }

        yes.addEventListener('click', () => close(true));
        no.addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', onKey);

        actions.append(yes, no);
        modal.append(t, m, actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}