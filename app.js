class MedicalPedigreeAnalyzer {
    constructor() {
        this.pedigreeData = { individuals: [], probandId: null, inheritancePattern: 'autosomal_dominant', carrierFrequency: 0.01 };
        this.selectedIndividual = null;
        this.zoomLevel = 1;
        this.panX = this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = this.lastMouseY = 0;
        this.generationY = [150, 300, 450, 600, 750]; // Increased spacing
        this.individualSpacing = 140;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showStartScreen();
    }

    showStartScreen() { document.getElementById('chartOverlay').classList.remove('hidden'); }
    hideStartScreen() { document.getElementById('chartOverlay').classList.add('hidden'); }

    setupEventListeners() {
        const svg = document.getElementById('pedigreeChart');
        const events = [
            ['addProbandBtn', 'click', () => this.addProband()],
            ['zoomInBtn', 'click', () => this.zoomIn()],
            ['zoomOutBtn', 'click', () => this.zoomOut()],
            ['resetViewBtn', 'click', () => this.resetView()],
            ['autoLayoutBtn', 'click', () => this.autoLayout()],
            ['addParentBtn', 'click', () => this.addParent()],
            ['addChildBtn', 'click', () => this.addChild()],
            ['addSpouseBtn', 'click', () => this.addSpouse()],
            ['addSiblingBtn', 'click', () => this.addSibling()],
            ['inheritanceSelect', 'change', e => { this.pedigreeData.inheritancePattern = e.target.value; this.calculateAllRisks(); this.renderPedigree(); }],
            ['carrierFreqInput', 'change', e => { this.pedigreeData.carrierFrequency = parseFloat(e.target.value); this.calculateAllRisks(); this.renderPedigree(); }],
            ['calculateRiskBtn', 'click', () => { this.calculateAllRisks(); this.renderPedigree(); }],
            ['closeInfoBtn', 'click', () => this.closeInfoPanel()],
            ['saveInfoBtn', 'click', () => this.saveIndividualInfo()],
            ['cancelInfoBtn', 'click', () => this.cancelEditInfo()],
            ['deleteIndividualBtn', 'click', () => this.deleteIndividual()],
            ['exportBtn', 'click', () => this.exportChart()],
            ['exportRiskBtn', 'click', () => this.exportRiskReport()],
            ['saveBtn', 'click', () => this.saveData()],
            ['loadBtn', 'click', () => this.loadData()],
            ['fileInput', 'change', e => this.handleFileLoad(e)],
            ['pedigreeChart', 'mousedown', e => this.startPan(e)],
            ['pedigreeChart', 'mousemove', e => this.pan(e)],
            ['pedigreeChart', 'mouseup', () => this.endPan()],
            ['pedigreeChart', 'mouseleave', () => this.endPan()]
        ];
        events.forEach(([id, event, handler]) => document.getElementById(id).addEventListener(event, handler));
    }

    addProband() {
        const name = prompt('Enter proband name/initials:');
        if (!name) return;
        const gender = confirm('Is the proband male? (Cancel for female)') ? 'male' : 'female';
        const affected = confirm('Is the proband affected by the genetic condition?');
        const proband = this.createNewIndividual({ name, gender, affected, generation: 3, position: 1, remarks: 'Proband - central individual for pedigree analysis' });
        proband.id = 'III-1'; // Ensure consistent ID for the first individual
        this.pedigreeData.individuals = [proband];
        this.pedigreeData.probandId = proband.id;
        this.hideStartScreen();
        this.renderPedigree();
        this.updateRelationshipButtons();
        setTimeout(() => this.selectIndividual(proband.id), 100);
    }

    renderPedigree() {
        const svg = document.getElementById('pedigreeChart');
        ['individuals', 'connections', 'labels', 'generationLines'].forEach(id => {
            const group = svg.getElementById(id);
            if (group) group.innerHTML = '';
        });
        if (!this.pedigreeData.individuals.length) return;
        this.renderGenerationLines(svg.getElementById('generationLines'), svg.getElementById('labels'));
        const generations = this.organizeByGenerations();
        Object.entries(generations).forEach(([gen, individuals]) => {
            this.positionIndividualsInGeneration(individuals, parseInt(gen));
            individuals.forEach(ind => this.renderIndividual(svg.getElementById('individuals'), ind));
        });
        this.renderAllConnections(svg.getElementById('connections'));
        this.applyTransform();
    }
    
    //renderMarriageLine to handle marital status ---
    renderMarriageLine(group, ind1, ind2) {
        const x1 = ind1.x < ind2.x ? ind1.x + 22 : ind1.x - 22;
        const y1 = ind1.y;
        const x2 = ind1.x < ind2.x ? ind2.x - 22 : ind2.x + 22;
        const y2 = ind2.y;

        const line = this.createSvgElement('line', { x1, y1, x2, y2 });

        const marriageInfo = ind1.marriageInfo || ind2.marriageInfo;
        let lineClass = 'marriage-line';
        if (marriageInfo && (marriageInfo.status === 'divorced' || marriageInfo.status === 'separated')) {
            lineClass += ' marriage-line--separated';
        }
        
        line.setAttribute('class', lineClass);
        group.appendChild(line);

        if (marriageInfo && (marriageInfo.status === 'divorced' || marriageInfo.status === 'separated')) {
            const midX = (parseFloat(x1) + parseFloat(x2)) / 2;
            const midY = (parseFloat(y1) + parseFloat(y2)) / 2;
            const slash = this.createSvgElement('line', {
                x1: midX - 8, y1: midY - 8, x2: midX + 8, y2: midY + 8,
                class: 'marriage-line-slash'
            });
            group.appendChild(slash);
        }
    }

    //renderParentChildLines for standard notation ---
    renderParentChildLines(group, child) {
        const parents = child.parentIds?.map(id => this.getIndividualById(id)).filter(p => p).sort((a,b) => a.position - b.position) || [];
        if (parents.length === 0) return;

        // Find all siblings to determine the sibship line
        const siblings = this.pedigreeData.individuals.filter(ind =>
            ind.parentIds && ind.parentIds.length === parents.length && ind.parentIds.every(id => child.parentIds.includes(id))
        ).sort((a, b) => a.position - b.position);

        // This check prevents drawing the line multiple times for each sibling
        if (child.id !== siblings[0].id) {
            return;
        }

        const firstSiblingX = siblings[0].x;
        const lastSiblingX = siblings[siblings.length - 1].x;
        const parentY = parents[0].y;
        const sibshipLineY = parentY + 50;

        if (parents.length === 1) {
             // Line from single parent down to the sibship line
            group.appendChild(this.createSvgElement('line', { x1: parents[0].x, y1: parentY + 22, x2: parents[0].x, y2: sibshipLineY, class: 'connection-line' }));
             // Horizontal sibship line
            group.appendChild(this.createSvgElement('line', { x1: firstSiblingX, y1: sibshipLineY, x2: lastSiblingX, y2: sibshipLineY, class: 'connection-line' }));

        } else if (parents.length === 2) {
            const midParentX = (parents[0].x + parents[1].x) / 2;
            // Vertical line from the parents' marriage line
            group.appendChild(this.createSvgElement('line', { x1: midParentX, y1: parentY, x2: midParentX, y2: sibshipLineY, class: 'connection-line' }));
            // Horizontal "sibship" line
            group.appendChild(this.createSvgElement('line', { x1: firstSiblingX, y1: sibshipLineY, x2: lastSiblingX, y2: sibshipLineY, class: 'connection-line' }));
        }

        // Vertical lines from the sibship line to each sibling
        siblings.forEach(sib => {
            group.appendChild(this.createSvgElement('line', { x1: sib.x, y1: sibshipLineY, x2: sib.x, y2: sib.y - 22, class: 'connection-line' }));
        });
    }

    //addParent to handle first or second parent ---
    addParent() {
        if (!this.selectedIndividual) return;
        const child = this.selectedIndividual;
        const existingParents = child.parentIds?.map(id => this.getIndividualById(id)).filter(Boolean) || [];

        if (existingParents.length >= 2) {
            alert('This individual already has two parents.');
            return;
        }

        const name = prompt('Enter parent name:');
        if (!name) return;

        let gender;
        if (existingParents.length === 1) {
            gender = existingParents[0].gender === 'male' ? 'female' : 'male';
            alert(`Adding ${name} as the ${gender}.`);
        } else {
            gender = confirm('Is this parent male? (Cancel for female)') ? 'male' : 'female';
        }

        const affected = confirm('Is this parent affected by the condition?');
        const parent = this.createNewIndividual({ name, gender, affected, generation: Math.max(1, child.generation - 1), childrenIds: [child.id] });
        
        this.pedigreeData.individuals.push(parent);
        child.parentIds = child.parentIds || [];
        child.parentIds.push(parent.id);

        if (existingParents.length === 1) {
            const firstParent = existingParents[0];
            firstParent.spouseId = parent.id;
            parent.spouseId = firstParent.id;
            
            // Add marriage info
            const status = prompt('Enter marital status (e.g., married, divorced, separated):', 'married');
             if (firstParent.id < parent.id) {
                firstParent.marriageInfo = { status: status || 'married' };
            } else {
                parent.marriageInfo = { status: status || 'married' };
            }
            alert(`${parent.name} and ${firstParent.name} are now linked as spouses.`);
        }
        
        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        alert(`Parent ${name} added successfully!`);
    }

    //addSpouse to include marital status ---
    addSpouse() {
        if (!this.selectedIndividual) return;
        const name = prompt('Enter spouse name:');
        if (!name) return;

        const status = prompt('Enter marital status (e.g., married, divorced, separated):', 'married');
        const gender = this.selectedIndividual.gender === 'male' ? 'female' : 'male';
        const affected = confirm('Is this spouse affected by the condition?');
        const spouse = this.createNewIndividual({ name, gender, affected, generation: this.selectedIndividual.generation, spouseId: this.selectedIndividual.id });

        if (this.selectedIndividual.id < spouse.id) {
            this.selectedIndividual.marriageInfo = { status: status || 'married' };
        } else {
            spouse.marriageInfo = { status: status || 'married' };
        }
        
        this.pedigreeData.individuals.push(spouse);
        this.selectedIndividual.spouseId = spouse.id;
        
        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        alert(`Spouse ${name} added successfully!`);
    }

    //editIndividual to populate marital status ---
    editIndividual() {
        const ind = this.selectedIndividual;
        if (!ind) return;

        document.getElementById('nameInput').value = ind.name || '';
        document.getElementById('genderSelect').value = ind.gender || 'unknown';
        document.getElementById('statusSelect').value = ind.affected ? 'affected' : ind.carrier ? 'carrier' : 'normal';
        document.getElementById('ageInput').value = ind.age || '';
        document.getElementById('birthYearInput').value = ind.birthYear || '';
        document.getElementById('deathYearInput').value = ind.deathYear || '';
        document.getElementById('deathAgeInput').value = ind.deathAge || '';
        document.getElementById('testResultSelect').value = ind.testResult || '';
        document.getElementById('conditionsInput').value = ind.conditions || '';
        document.getElementById('remarksInput').value = ind.remarks || '';
        
        // Handle marital status
        const spouse = this.getIndividualById(ind.spouseId);
        const maritalStatusSelect = document.getElementById('maritalStatusSelect');
        if (spouse) {
            const marriageInfo = ind.marriageInfo || spouse.marriageInfo;
            maritalStatusSelect.value = marriageInfo ? marriageInfo.status : 'married';
            maritalStatusSelect.disabled = false;
        } else {
            maritalStatusSelect.value = 'married';
            maritalStatusSelect.disabled = true;
        }

        document.getElementById('infoContent').classList.add('hidden');
        document.getElementById('infoForm').classList.remove('hidden');
    }

    //saveIndividualInfo to save marital status ---
    saveIndividualInfo() {
        if (!this.selectedIndividual) return;
        const ind = this.selectedIndividual;
        
        ind.name = document.getElementById('nameInput').value;
        ind.gender = document.getElementById('genderSelect').value;
        const status = document.getElementById('statusSelect').value;
        ind.affected = status === 'affected';
        ind.carrier = status === 'carrier';
        ind.age = document.getElementById('ageInput').value;
        ind.birthYear = document.getElementById('birthYearInput').value;
        // ... (rest of the properties)
        ind.deathYear = document.getElementById('deathYearInput').value;
        ind.deathAge = document.getElementById('deathAgeInput').value;
        ind.testResult = document.getElementById('testResultSelect').value;
        ind.conditions = document.getElementById('conditionsInput').value;
        ind.remarks = document.getElementById('remarksInput').value;

        // Save marital status
        const spouse = this.getIndividualById(ind.spouseId);
        if (spouse) {
            const newStatus = document.getElementById('maritalStatusSelect').value;
            // Remove old info to prevent conflicts
            delete ind.marriageInfo;
            delete spouse.marriageInfo;
            // Add new info to the one with the smaller ID
            if (ind.id < spouse.id) {
                ind.marriageInfo = { status: newStatus };
            } else {
                spouse.marriageInfo = { status: newStatus };
            }
        }
        
        this.calculateAllRisks();
        this.renderPedigree();
        this.selectIndividual(ind.id); // Reselect to show updated info
    }

    //updateRelationshipButtons for more robust checks ---
    updateRelationshipButtons() {
        const sel = this.selectedIndividual;
        document.getElementById('addParentBtn').disabled = !sel || sel.generation <= 1 || (sel.parentIds && sel.parentIds.length >= 2);
        document.getElementById('addChildBtn').disabled = !sel || sel.generation >= 5;
        document.getElementById('addSpouseBtn').disabled = !sel || sel.spouseId;
        document.getElementById('addSiblingBtn').disabled = !sel || !sel.parentIds || sel.parentIds.length === 0;
    }

    // --- NO CHANGES NEEDED for the rest of the functions, but including for completeness ---
    // (The rest of your app.js code from the previous response would go here)
    // ... createNewIndividual, autoLayout, closeInfoPanel, zoom functions, pan functions,
    // ... export functions, save/load functions, getIndividualById, toRoman, etc.
    // ... I will paste the remaining functions below for a complete file.

    renderGenerationLines(linesGroup, labelsGroup) {
        const labels = ['I - Great-grandparents', 'II - Grandparents', 'III - Parents & Proband', 'IV - Children', 'V - Grandchildren'];
        this.generationY.forEach((y, i) => {
            const line = this.createSvgElement('line', { x1: '80', y1: y, x2: '1320', y2: y, class: 'generation-line' });
            linesGroup.appendChild(line);
            const label = this.createSvgElement('text', { x: '20', y: y - 10, class: 'generation-label-text' }, labels[i]);
            labelsGroup.appendChild(label);
        });
    }

    organizeByGenerations() {
        const generations = {};
        this.pedigreeData.individuals.forEach(ind => {
            generations[ind.generation] = generations[ind.generation] || [];
            generations[ind.generation].push(ind);
        });
        Object.values(generations).forEach(gen => gen.sort((a, b) => a.position - b.position));
        return generations;
    }

    positionIndividualsInGeneration(individuals, generation) {
        const centerX = 700;
        const totalWidth = (individuals.length - 1) * this.individualSpacing;
        const startX = centerX - totalWidth / 2;
        individuals.forEach((ind, i) => {
            ind.x = startX + i * this.individualSpacing;
            ind.y = this.generationY[generation - 1];
        });
    }
    
    renderIndividual(group, ind) {
        const g = this.createSvgElement('g', { class: 'individual-group', 'data-id': ind.id });
        g.appendChild(this.createIndividualSymbol(ind));
        if (ind.id === this.pedigreeData.probandId) this.addProbandMarker(g, ind);
        g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 6, class: 'individual-text individual-id', fill: ind.affected ? '#ffffff' : '#000000' }, ind.id));
        g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 40, class: 'individual-text individual-name' }, this.truncateText(ind.name, 12)));
        if (ind.age || ind.birthYear) {
            const ageInfo = ind.age ? `${ind.age}y` : ind.deathYear ? `${ind.birthYear}-${ind.deathYear}` : `b.${ind.birthYear}`;
            g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 52, class: 'individual-text individual-age' }, ageInfo));
        }
        if (ind.calculatedRisks && Object.keys(ind.calculatedRisks).length) {
            const mainRisk = Math.max(...Object.values(ind.calculatedRisks).filter(r => r > 0)) || 0;
            if (mainRisk > 0) g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y - 35, class: 'individual-text risk-percentage' }, `${mainRisk.toFixed(0)}% risk`));
        }
        group.appendChild(g);
    }
    
    createIndividualSymbol(ind) {
        let symbol;
        if (ind.gender === 'unknown') {
            const points = [[ind.x, ind.y - 22], [ind.x + 22, ind.y], [ind.x, ind.y + 22], [ind.x - 22, ind.y]].map(p => p.join(',')).join(' ');
            symbol = this.createSvgElement('polygon', { points, class: 'individual-symbol', 'data-id': ind.id });
        } else {
            symbol = this.createSvgElement(ind.gender === 'female' ? 'circle' : 'rect', {
                class: 'individual-symbol',
                'data-id': ind.id,
                ...(ind.gender === 'female' ? { cx: ind.x, cy: ind.y, r: '22' } : { x: ind.x - 22, y: ind.y - 22, width: '44', height: '44' })
            });
        }
        symbol.addEventListener('click', e => { e.stopPropagation(); this.selectIndividual(ind.id); });
        this.styleIndividualSymbol(symbol, ind);
        return symbol;
    }

    styleIndividualSymbol(symbol, ind) {
        let fill = 'var(--color-surface)';
        if (ind.affected) {
            fill = 'var(--color-text)';
        } else if (ind.carrier) {
            const gradientId = `carrier-gradient-${ind.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            this.createCarrierGradient(gradientId);
            fill = `url(#${gradientId})`;
        }
        symbol.setAttribute('fill', fill);
        symbol.setAttribute('stroke', 'var(--color-text)');
        symbol.setAttribute('stroke-width', '2');
        if (ind.id === this.selectedIndividual?.id) {
            symbol.classList.add('selected');
        }
    }

    createCarrierGradient(id) {
        const svg = document.getElementById('pedigreeChart');
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = this.createSvgElement('defs');
            svg.prepend(defs);
        }
        if (document.getElementById(id)) return;
        const gradient = this.createSvgElement('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
        gradient.appendChild(this.createSvgElement('stop', { offset: '50%', 'stop-color': 'var(--color-surface)' }));
        gradient.appendChild(this.createSvgElement('stop', { offset: '50%', 'stop-color': 'var(--color-warning)' }));
        defs.appendChild(gradient);
    }

    addProbandMarker(group, ind) {
        const points = [[ind.x - 45, ind.y], [ind.x - 35, ind.y - 8], [ind.x - 35, ind.y + 8]].map(p => p.join(',')).join(' ');
        group.appendChild(this.createSvgElement('polygon', { points, class: 'proband-arrow' }));
        group.appendChild(this.createSvgElement('text', { x: ind.x - 55, y: ind.y + 5, class: 'proband-text' }, 'P'));
    }

    createSvgElement(tag, attrs = {}, text = '') {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (text) el.textContent = text;
        return el;
    }

    truncateText(text, max) { return text && text.length > max ? text.substring(0, max) + '...' : text || ''; }

    renderAllConnections(group) {
        const drawnParentConnections = new Set();
        this.pedigreeData.individuals.forEach(ind => {
            if (ind.spouseId) {
                const spouse = this.getIndividualById(ind.spouseId);
                if (spouse && ind.id < spouse.id) {
                    this.renderMarriageLine(group, ind, spouse);
                }
            }
            if (ind.parentIds?.length) {
                const parentIdKey = ind.parentIds.sort().join(',');
                if (!drawnParentConnections.has(parentIdKey)) {
                    this.renderParentChildLines(group, ind);
                    drawnParentConnections.add(parentIdKey);
                }
            }
        });
    }

    selectIndividual(id) {
        document.querySelectorAll('.individual-symbol.selected').forEach(el => el.classList.remove('selected'));
        const symbol = document.querySelector(`.individual-symbol[data-id="${id}"]`);
        if (symbol) symbol.classList.add('selected');
        
        this.selectedIndividual = this.getIndividualById(id);
        this.showIndividualInfo(this.selectedIndividual);
        this.updateRelationshipButtons();
    }

    showIndividualInfo(ind) {
        if (!ind) return this.closeInfoPanel();
        if (!ind.calculatedRisks) ind.calculatedRisks = this.calculateIndividualRisk(ind);
        const infoContent = document.getElementById('infoContent');
        
        let spouseName = 'N/A';
        if (ind.spouseId) {
            const spouse = this.getIndividualById(ind.spouseId);
            if (spouse) spouseName = `${spouse.name} (${spouse.id})`;
        }

        infoContent.innerHTML = `
            <div class="individual-details">
                <div class="individual-header">
                    <h4>${ind.name} (${ind.id})</h4>
                    <span class="status-indicator ${ind.affected ? 'affected' : ind.carrier ? 'carrier' : 'normal'}"></span>
                    ${ind.id === this.pedigreeData.probandId ? '<span class="medical-badge">Proband</span>' : ''}
                </div>
                <div class="detail-grid">
                    <div class="detail-row"><span class="detail-label">Gender</span><span class="detail-value">${ind.gender ? ind.gender[0].toUpperCase() + ind.gender.slice(1) : 'Unknown'}</span></div>
                    <div class="detail-row"><span class="detail-label">Generation</span><span class="detail-value">${this.toRoman(ind.generation)}</span></div>
                    <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${ind.affected ? 'Affected' : ind.carrier ? 'Carrier' : 'Normal'}</span></div>
                    <div class="detail-row"><span class="detail-label">Spouse</span><span class="detail-value">${spouseName}</span></div>
                    ${ind.age ? `<div class="detail-row"><span class="detail-label">Age</span><span class="detail-value">${ind.age}</span></div>` : ''}
                    ${ind.birthYear ? `<div class="detail-row"><span class="detail-label">Birth Year</span><span class="detail-value">${ind.birthYear}</span></div>` : ''}
                    ${ind.testResult ? `<div class="detail-row"><span class="detail-label">Genetic Test</span><span class="detail-value">${ind.testResult}</span></div>` : ''}
                </div>
                ${this.renderRiskAnalysis(ind)}
                ${ind.conditions ? `<div class="clinical-section"><h5>Medical Conditions</h5><div class="clinical-text">${ind.conditions}</div></div>` : ''}
                ${ind.remarks ? `<div class="clinical-section"><h5>Clinical Remarks</h5><div class="clinical-text">${ind.remarks}</div></div>` : ''}
            </div>
            <button class="btn btn--primary btn--sm" id="editIndividualBtn">Edit Information</button>`;
        
        document.getElementById('editIndividualBtn').addEventListener('click', () => this.editIndividual());
        infoContent.classList.remove('hidden');
        document.getElementById('infoForm').classList.add('hidden');
    }

    renderRiskAnalysis(ind) {
        if (!ind.calculatedRisks || !Object.keys(ind.calculatedRisks).length) return '';
        const riskEntries = Object.entries(ind.calculatedRisks)
            .filter(([, v]) => v > 0)
            .map(([type, value]) => `<div class="risk-item"><span class="risk-label">${this.formatRiskType(type)}</span><span class="risk-value ${value >= 50 ? 'risk-high' : value >= 25 ? 'risk-medium' : 'risk-low'}">${value.toFixed(1)}%</span></div>`).join('');
        return riskEntries ? `<div class="risk-analysis"><h5>Genetic Risk Analysis</h5>${riskEntries}</div>` : '';
    }

    formatRiskType(type) {
        return { carrier: 'Carrier Risk', affected: 'Affected Risk', offspring_affected: 'Offspring Affected Risk', offspring_carrier: 'Offspring Carrier Risk' }[type] || type;
    }

    calculateAllRisks() { this.pedigreeData.individuals.forEach(ind => ind.calculatedRisks = this.calculateIndividualRisk(ind)); }

    calculateIndividualRisk(ind) {
        const { inheritancePattern: pattern, carrierFrequency: freq } = this.pedigreeData;
        return pattern === 'autosomal_dominant' ? this.calculateAutosmalDominantRisk(ind) :
               pattern === 'autosomal_recessive' ? this.calculateAutosmalRecessiveRisk(ind, freq) :
               pattern === 'x_linked' ? this.calculateXLinkedRisk(ind) : {};
    }

    calculateAutosmalDominantRisk(ind) {
        const risks = {};
        if (ind.testResult === 'positive' || ind.affected) {
            risks.affected = 100;
        } else if (ind.testResult === 'negative') {
            risks.affected = 0;
        } else if (this.getAffectedParents(ind) > 0) {
            risks.affected = 50;
        }

        if (ind.affected || risks.affected === 100) {
            risks.offspring_affected = 50;
        }
        return risks;
    }

    calculateAutosmalRecessiveRisk(ind, freq) {
        const risks = {};
        if (ind.testResult === 'positive' || ind.affected) {
            risks.affected = 100;
            risks.carrier = 100;
            return risks;
        }
        if (ind.testResult === 'carrier') {
            risks.carrier = 100;
            risks.affected = 0;
            return risks;
        }
        if (ind.testResult === 'negative') {
            risks.carrier = 0;
            risks.affected = 0;
            return risks;
        }

        const parents = ind.parentIds?.map(id => this.getIndividualById(id)).filter(p => p);
        const isParentAffected = parents.some(p => p.affected);
        const areBothParentsCarriers = parents.length === 2 && parents.every(p => this.isKnownCarrier(p));
        
        if (isParentAffected) {
            risks.carrier = 100;
        } else if (areBothParentsCarriers) {
            risks.carrier = 66.7; // 2/3 chance of being a carrier if phenotypically normal
            risks.affected = 25;
        } else {
             // General population risk if no other information
            risks.carrier = 2 * Math.sqrt(freq) * (1-Math.sqrt(freq)) * 100;
        }

        if (this.isKnownCarrier(ind)) {
             const spouse = this.getIndividualById(ind.spouseId);
             if (spouse) {
                if(this.isKnownCarrier(spouse)) {
                    risks.offspring_affected = 25;
                    risks.offspring_carrier = 50;
                } else {
                    // Spouse risk is from general population
                    risks.offspring_affected = (2 * Math.sqrt(freq) * (1-Math.sqrt(freq))) * 0.25 * 100;
                }
             }
        }
        
        return risks;
    }
    
    isKnownCarrier(ind) {
        if (!ind) return false;
        return ind.carrier || ind.testResult === 'carrier' || ind.affected || (ind.calculatedRisks && ind.calculatedRisks.carrier === 100);
    }

    calculateXLinkedRisk(ind) {
        const risks = {};
        const mother = this.getIndividualById(ind.parentIds?.find(id => this.getIndividualById(id)?.gender === 'female'));
        const father = this.getIndividualById(ind.parentIds?.find(id => this.getIndividualById(id)?.gender === 'male'));

        if (ind.gender === 'male') {
            if (mother && (this.isKnownCarrier(mother) || mother.affected)) {
                risks.affected = 50;
            }
        } else if (ind.gender === 'female') {
            if (father && father.affected) {
                risks.carrier = 100;
            } else if (mother && (this.isKnownCarrier(mother) || mother.affected)) {
                risks.carrier = 50;
            }
        }
        return risks;
    }
    
    getAffectedParents(ind) { return ind.parentIds?.map(id => this.getIndividualById(id)).filter(p => p?.affected).length || 0; }

    addSibling() {
        if (!this.selectedIndividual || !this.selectedIndividual.parentIds || this.selectedIndividual.parentIds.length === 0) {
            alert("Cannot add a sibling to an individual without parents in the chart.");
            return;
        }
        const name = prompt('Enter sibling name:');
        if (!name) return;
        const gender = confirm('Is this sibling male? (Cancel for female)') ? 'male' : 'female';
        const affected = confirm('Is this sibling affected by the condition?');
        const sibling = this.createNewIndividual({
            name, gender, affected,
            generation: this.selectedIndividual.generation,
            parentIds: [...this.selectedIndividual.parentIds]
        });
        
        this.pedigreeData.individuals.push(sibling);
        this.selectedIndividual.parentIds?.forEach(pid => {
            const parent = this.getIndividualById(pid);
            if (parent) {
                parent.childrenIds = parent.childrenIds || [];
                parent.childrenIds.push(sibling.id);
            }
        });

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        alert(`Sibling ${name} added successfully!`);
    }

    addChild() {
        if (!this.selectedIndividual) return;
        const parent1 = this.selectedIndividual;
        const parent2 = this.getIndividualById(parent1.spouseId);

        if (!parent2) {
            alert(`${parent1.name} needs a spouse to add a child. Please add a spouse first.`);
            return;
        }

        const name = prompt('Enter child name:');
        if (!name) return;
        const gender = confirm('Is this child male? (Cancel for female)') ? 'male' : 'female';
        const affected = confirm('Is this child affected by the condition?');
        const child = this.createNewIndividual({
            name, gender, affected,
            generation: Math.min(5, parent1.generation + 1),
            parentIds: [parent1.id, parent2.id]
        });

        this.pedigreeData.individuals.push(child);
        parent1.childrenIds = parent1.childrenIds || [];
        parent1.childrenIds.push(child.id);
        parent2.childrenIds = parent2.childrenIds || [];
        parent2.childrenIds.push(child.id);

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        alert(`Child ${name} added successfully!`);
    }

    createNewIndividual({ name, gender, affected, generation, position, spouseId, parentIds, childrenIds, remarks }) {
        const genRoman = this.toRoman(generation);
        const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === generation);
        const nextPos = position || (individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position)) + 1 : 1);
        
        return {
            id: `${genRoman}-${nextPos}`,
            name, gender, generation, position: nextPos, affected: affected || false, carrier: false,
            age: '', birthYear: '', deathYear: '', deathAge: '', testResult: '', conditions: '', remarks: remarks || '',
            spouseId: spouseId || null, parentIds: parentIds || [], childrenIds: childrenIds || [], calculatedRisks: {}
        };
    }

    autoLayout() {
        Object.values(this.organizeByGenerations()).forEach(gen => {
            gen.forEach((ind, i) => {
                ind.position = i + 1;
            });
        });
        this.renderPedigree();
    }

    closeInfoPanel() {
        document.querySelectorAll('.individual-symbol.selected').forEach(el => el.classList.remove('selected'));
        this.selectedIndividual = null;
        this.updateRelationshipButtons();
        const infoContent = document.getElementById('infoContent');
        infoContent.innerHTML = '<p class="info-placeholder">Click on an individual in the pedigree to view their information and calculated risks.</p>';
        infoContent.classList.remove('hidden');
        document.getElementById('infoForm').classList.add('hidden');
    }

    cancelEditInfo() { if (this.selectedIndividual) this.showIndividualInfo(this.selectedIndividual); }

    deleteIndividual() {
        if (!this.selectedIndividual) return;
        if (this.selectedIndividual.id === this.pedigreeData.probandId) {
            alert('Cannot delete the proband. To delete this individual, please assign a new proband first.');
            return;
        }
        if (confirm(`Are you sure you want to delete ${this.selectedIndividual.name}? This cannot be undone.`)) {
            const idToDelete = this.selectedIndividual.id;
            this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => ind.id !== idToDelete);
            this.pedigreeData.individuals.forEach(ind => {
                if (ind.spouseId === idToDelete) ind.spouseId = null;
                if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => pid !== idToDelete);
                if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => cid !== idToDelete);
            });
            this.closeInfoPanel();
            this.renderPedigree();
        }
    }

    zoomIn() { this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3); this.applyTransform(); }
    zoomOut() { this.zoomLevel = Math.max(this.zoomLevel * 0.8, 0.3); this.applyTransform(); }
    resetView() { this.zoomLevel = 1; this.panX = this.panY = 0; this.applyTransform(); }
    applyTransform() { document.getElementById('pedigreeChart').style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`; }
    startPan(e) { if (e.target.closest('.individual-group')) return; this.isDragging = true; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; e.preventDefault(); }
    pan(e) { if (!this.isDragging) return; this.panX += e.clientX - this.lastMouseX; this.panY += e.clientY - this.lastMouseY; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; this.applyTransform(); }
    endPan() { this.isDragging = false; }

    // File operations
    exportChart() {
        try {
            const svg = document.getElementById('pedigreeChart');
            const svgData = new XMLSerializer().serializeToString(svg);
            
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pedigree-${new Date().toISOString().slice(0,10)}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert('Chart exported successfully as SVG!');
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting chart.');
        }
    }

    exportRiskReport() {
        const report = this.generateRiskReport();
        const blob = new Blob([report], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = `risk-report-${new Date().toISOString().slice(0,10)}.txt`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        alert('Risk assessment report exported successfully!');
    }

    generateRiskReport() {
        const proband = this.getIndividualById(this.pedigreeData.probandId);
        const reportDate = new Date().toLocaleDateString();
        
        let report = `GENETIC RISK ASSESSMENT REPORT\n`;
        report += `Generated on: ${reportDate}\n`;
        report += `Inheritance Pattern: ${this.pedigreeData.inheritancePattern.replace('_', ' ').toUpperCase()}\n`;
        report += `Population Carrier Frequency: ${this.pedigreeData.carrierFrequency}\n`;
        report += `Proband: ${proband ? proband.name : 'Unknown'} (${this.pedigreeData.probandId})\n\n`;
        
        report += `INDIVIDUAL RISK ASSESSMENTS:\n`;
        report += `${'='.repeat(50)}\n\n`;
        
        this.pedigreeData.individuals.forEach(individual => {
            report += `${individual.name} (${individual.id})\n`;
            report += `Generation: ${this.toRoman(individual.generation)}\n`;
            report += `Gender: ${individual.gender.charAt(0).toUpperCase() + individual.gender.slice(1)}\n`;
            report += `Status: ${individual.affected ? 'Affected' : individual.carrier ? 'Carrier' : 'Normal'}\n`;
            
            if (individual.testResult) {
                report += `Genetic Test: ${individual.testResult}\n`;
            }
            
            if (individual.calculatedRisks && Object.keys(individual.calculatedRisks).length > 0) {
                report += `Calculated Risks:\n`;
                Object.entries(individual.calculatedRisks).forEach(([type, value]) => {
                    if (value > 0) {
                        report += `  - ${this.formatRiskType(type)}: ${value}%\n`;
                    }
                });
            }
            
            if (individual.conditions) {
                report += `Medical Conditions: ${individual.conditions}\n`;
            }
            
            report += `\n`;
        });
        
        report += `\nRECOMMENDations:\n`;
        report += `${'='.repeat(20)}\n`;
        report += `- Genetic counseling recommended for all at-risk individuals\n`;
        report += `- Consider genetic testing for carriers and at-risk family members\n`;
        report += `- Regular medical surveillance for affected individuals\n`;
        report += `- Family planning counseling for reproductive-age individuals\n`;
        
        return report;
    }

    saveData() {
        try {
            const dataStr = JSON.stringify(this.pedigreeData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            link.download = `pedigree-data-${new Date().toISOString().slice(0,10)}.json`;
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            alert('Pedigree data saved successfully!');
        } catch (error) {
            console.error('Save error:', error);
            alert('Error saving data.');
        }
    }

    loadData() {
        document.getElementById('fileInput').click();
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.pedigreeData = data;
                this.hideStartScreen();
                this.closeInfoPanel();
                this.calculateAllRisks();
                this.renderPedigree();
                alert('Pedigree data loaded successfully!');
            } catch (error) {
                console.error('Load error:', error);
                alert('Error loading file: Invalid format');
            }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    }
    getIndividualById(id) { return this.pedigreeData.individuals.find(ind => ind.id === id); }
    toRoman(num) {
        if (isNaN(num)) return '';
        const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let result = '';
        for (let key in map) {
            while (num >= map[key]) {
                result += key;
                num -= map[key];
            }
        }
        return result;
    }
}

document.addEventListener('DOMContentLoaded', () => new MedicalPedigreeAnalyzer());
