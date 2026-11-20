'use strict';
export function handleClose(e) {
    if (e) e.preventDefault();
    window.close();
    setTimeout(() => { if (!window.closed) window.location.href = '/'; }, 100);
}