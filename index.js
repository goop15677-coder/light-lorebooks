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

    // --- 2. AUTO-FIX RACE CONDITION ON IMPORT ---
    const context = SillyTavern.getContext();
    if (context.eventSource && context.event_types) {
        context.eventSource.on(context.event_types.CHARACTER_IMPORTED, () => {
            // Wait 1.5 seconds for ST to finish its UI updates
            setTimeout(async () => {
                const char = context.characters[context.characterId];
                const worldName = char?.data?.extensions?.world || char?.world;
                
                // If the character has a lorebook assigned, but the dropdown didn't link it...
                if (worldName) {
                    const $dropdown = jQuery('#character_world');
                    if ($dropdown.length > 0 && $dropdown.val() !== worldName) {
                        try {
                            // Force the refresh and link
                            const module = await import('../../../world-info.js');
                            if (module.updateWorldInfoList) await module.updateWorldInfoList();
                            
                            $dropdown.val(worldName).trigger('change');
                            console.log(`[Auto-Link] Forced link for lorebook: ${worldName}`);
                        } catch (e) {
                            console.error("[Auto-Link] Failed to force link:", e);
                        }
                    }
                }
            }, 1500);
        });
    }

    // --- 3. LOREBOOK USAGE INDICATORS (DOM Injection on Open) ---
    jQuery(document).on('select2:open', function(e) {
        if (e.target.id !== 'world_editor_select') return;

        setTimeout(() => {
            if (!context || !context.characters) return;

            const usedLorebooks = new Set();
            context.characters.forEach(char => {
                const w = char?.data?.extensions?.world || char?.world;
                if (w) usedLorebooks.add(w);
            });

            const dropdownId = '#select2-world_editor_select-results';
            const $dropdown = jQuery(dropdownId);
            if ($dropdown.length === 0) return;

            $dropdown.find('.select2-results__option').each(function() {
                const $li = jQuery(this);
                const text = $li.text().trim();
                
                if ($li.find('.cl-used-icon').length > 0) return;
                if (text === '' || text.includes('--- Pick to Edit ---')) return;

                if (usedLorebooks.has(text)) {
                    $li.prepend('<span class="cl-used-icon" style="color: #4caf50; margin-right: 6px;" title="Linked to a character">👤</span>');
                } else {
                    $li.prepend('<span class="cl-used-icon" style="color: #f44336; margin-right: 6px;" title="Not linked to any character">🔴</span>');
                }
            });
        }, 50);
    });
});
