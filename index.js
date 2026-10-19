jQuery(async () => {
    // --- 1. AUTO DELETE POPUP OBSERVER ---
    const observer = new MutationObserver(() => {
        const popup = Array.from(document.querySelectorAll('.popup-content')).find(el => el.querySelector('#del_char_checkbox'));
        if (!popup) return;

        const delCharCheckbox = popup.querySelector('#del_char_checkbox');
        const hasOurCheckbox = popup.querySelector('#del_lorebook_checkbox');

        if (delCharCheckbox && !hasOurCheckbox) {
            const context = SillyTavern.getContext();
            const character = context.characters[context.characterId];
            
            const linkedWorld = character?.data?.extensions?.world || character?.world;

            if (linkedWorld) {
                const originalLabel = delCharCheckbox.closest('.checkbox_label');
                
                if (originalLabel) {
                    const newLabel = document.createElement('label');
                    newLabel.className = 'checkbox_label justifyCenter';
                    newLabel.style.marginTop = '10px';
                    newLabel.innerHTML = `
                        <input type="checkbox" id="del_lorebook_checkbox" checked>
                        <small style="color: #ff6b6b;">Also delete linked lorebook: ${linkedWorld}</small>
                    `;
                    
                    originalLabel.insertAdjacentElement('afterend', newLabel);
                    
                    const yesButton = popup.parentElement.querySelector('.popup-button-ok');
                    if (yesButton) {
                        yesButton.addEventListener('click', () => {
                            const shouldDelete = document.getElementById('del_lorebook_checkbox')?.checked;
                            if (shouldDelete) {
                                const headers = context.getRequestHeaders ? context.getRequestHeaders() : {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-Token': context.token
                                };

                                fetch('/api/worldinfo/delete', {
                                    method: 'POST',
                                    headers: headers,
                                    body: JSON.stringify({ name: linkedWorld })
                                }).then((response) => {
                                    if (response.ok) {
                                        if (window.toastr) toastr.success(`Deleted lorebook: ${linkedWorld}`);
                                        import('../../../world-info.js').then(module => {
                                            if (module.updateWorldInfoList) module.updateWorldInfoList();
                                        }).catch(err => console.error("[Auto-Delete] Failed to load UI refresh:", err));
                                    }
                                }).catch(err => console.error("[Auto-Delete] Error:", err));
                            }
                        }, { once: true });
                    }
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });


    // --- 2. LOREBOOK USAGE INDICATORS ---
    // Wait a moment for SillyTavern to load and initialize Select2
    setTimeout(() => {
        const formatLorebookOption = function(state) {
            if (!state.id || state.text.includes('Pick to Edit') || state.text === '') {
                return state.text;
            }

            const context = SillyTavern.getContext();
            if (!context || !context.characters) return state.text;

            // Check if any character uses this lorebook
            const isUsed = context.characters.some(char => {
                const w = char?.data?.extensions?.world || char?.world;
                return w === state.text;
            });

            if (isUsed) {
                // Green User icon for linked
                return jQuery(`<span><span style="color: #4caf50; margin-right: 6px;" title="Linked to a character">👤</span>${state.text}</span>`);
            } else {
                // Red dot for orphaned
                return jQuery(`<span><span style="color: #f44336; margin-right: 6px;" title="Not linked to any character">🔴</span>${state.text}</span>`);
            }
        };

        // Apply the custom formatting to the Select2 dropdowns natively
        if (jQuery('#world_editor_select').data('select2')) {
            jQuery('#world_editor_select').select2({ templateResult: formatLorebookOption });
        }
        if (jQuery('#world_info').data('select2')) {
            jQuery('#world_info').select2({ templateResult: formatLorebookOption });
        }
    }, 1500); // 1.5 second delay to ensure ST is fully loaded
});
