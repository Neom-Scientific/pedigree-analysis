class MedicalPedigreeAnalyzer {
    constructor() {
        this.pedigreeData = { individuals: [], probandId: null, inheritancePattern: 'autosomal_dominant', carrierFrequency: 0.01 };
        this.selectedIndividual = null;
        this.selectedIndividuals = []; // For multi-selection
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
        document.getElementById('autoLayoutBtn').classList.add('hidden');
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
            ['pedigreeChart', 'mouseleave', () => this.endPan()],
            ['clearBtn', 'click', () => this.clearData()],
            ['addPragnancyBtn', 'click', () => this.addPregnancy()],
            ['addTwinBtn', 'click', () => this.addTwin()],
            ['addTerminationBtn', 'click', () => this.addTermination()],
            ['addNoOffspringBtn', 'click', () => this.addNoOffspringOrInfertility()],
        ];
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') {
                if (this.selectedIndividuals && this.selectedIndividuals.length > 0) {
                    this.deleteSelectedIndividuals();
                }
            }
        });
        document.getElementById('pedigreeChart').addEventListener('click', e => {
            if (e.target === e.currentTarget) {
                this.selectedIndividuals = [];
                this.selectedIndividual = null;
                this.updateMultiSelection();
                this.closeInfoPanel();
            }
        });
        events.forEach(([id, event, handler]) => document.getElementById(id).addEventListener(event, handler));
    }

    addProband() {
        const name = prompt('Enter proband name/initials:');
        if (!name) return;
        const genderInput = prompt('Select proband gender:\n1 = Male\n2 = Female', '1');
        let gender;
        if (genderInput === '1') gender = 'male';
        else if (genderInput === '2') gender = 'female';
        else return;
        const affected = confirm('Is the proband affected by the genetic condition?');
        // const customeDialog = customConfirm('are you sure').then((result) => {
        //     if(result) console.log('yes');
        //     else console.log('no');
        // });
        // const a = confirm('Are you sure?');
        const proband = this.createNewIndividual({
            name,
            gender,
            affected,
            generation: 3,
            position: 1,
            remarks: 'Proband - central individual for pedigree analysis'
        });
        proband.id = 'III-1'; // Ensure consistent ID for the first individual
        this.pedigreeData.individuals = [proband];
        this.pedigreeData.probandId = proband.id;
        this.hideStartScreen();
        this.renderPedigree();
        this.updateRelationshipButtons();
        setTimeout(() => this.selectIndividual(proband.id), 100);
    }

    addPregnancy() {
        if (!this.selectedIndividual) {
            alert('Please select an individual first.');
            return;
        }
        const parent1 = this.selectedIndividual;
        const parent2 = this.getIndividualById(parent1.spouseId);

        // Prompt for pregnancy type
        const input = prompt('Add Pregnancy:\n1 - Female\n2 - Male\n3 - Unknown', '1');
        let gender;
        if (input === '1') gender = 'female';
        else if (input === '2') gender = 'male';
        else if (input === '3') gender = 'unknown';
        else return;

        // Create pregnancy child
        const child = this.createNewIndividual({
            name: 'Pregnancy',
            gender: gender,
            affected: false,
            generation: Math.min(5, parent1.generation + 1),
            parentIds: parent2 ? [parent1.id, parent2.id] : [parent1.id],
            remarks: 'Pregnancy',
        });
        child.isPregnancy = true; // Mark as pregnancy

        this.pedigreeData.individuals.push(child);

        // Add child to parents' childrenIds
        parent1.childrenIds = parent1.childrenIds || [];
        parent1.childrenIds.push(child.id);
        if (parent2) {
            parent2.childrenIds = parent2.childrenIds || [];
            parent2.childrenIds.push(child.id);
        }

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert('Pregnancy added successfully!');
    }

    addTwin() {
        if (!this.selectedIndividual) return;
        const parent1 = this.selectedIndividual;
        const parent2 = this.getIndividualById(parent1.spouseId);

        if (!parent2) {
            alert(`${parent1.name} needs a spouse to add twins. Please add a spouse first.`);
            return;
        }

        // Prompt for twin type
        const twinType = prompt('Twin type:\n1 = Identical (monozygotic)\n2 = Fraternal (dizygotic)', '1');
        if (!twinType) return;

        // Prompt for genders
        let gender1, gender2;
        if (twinType === '1') {
            const genderInput = prompt('Select twins gender:\n1 = Male\n2 = Female', '1');
            if (genderInput === '1') gender1 = 'male';
            else if (genderInput === '2') gender1 = 'female';
            else return;
            gender2 = gender1;
        } else {
            const g = prompt('Fraternal twins gender:\n1 = Male & Male\n2 = Female & Female\n3 = Male & Female', '3');
            if (g === '1') { gender1 = 'male'; gender2 = 'male'; }
            else if (g === '2') { gender1 = 'female'; gender2 = 'female'; }
            else { gender1 = 'male'; gender2 = 'female'; }
        }

        // Prompt for names and affected status
        const name1 = prompt('Enter name/initials for Twin 1:');
        if (!name1) return;
        const affected1 = confirm('Is Twin 1 affected?');
        const name2 = prompt('Enter name/initials for Twin 2:');
        if (!name2) return;
        const affected2 = confirm('Is Twin 2 affected?');

        // Generate IDs for both twins
        const generation = Math.min(5, parent1.generation + 1);
        const genRoman = this.toRoman(generation);
        const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === generation);
        const nextPos = individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position)) + 1 : 1;
        const id1 = `${genRoman}-${nextPos}`;
        const id2 = `${genRoman}-${nextPos + 1}`;

        // Create both twins with explicit IDs
        const parentIds = [parent1.id, parent2.id];
        const twin1 = this.createNewIndividual({
            name: name1,
            gender: gender1,
            affected: affected1,
            generation,
            position: nextPos,
            parentIds,
            remarks: twinType === '1' ? 'Identical twin' : 'Fraternal twin'
        });
        const twin2 = this.createNewIndividual({
            name: name2,
            gender: gender2,
            affected: affected2,
            generation,
            position: nextPos + 1,
            parentIds,
            remarks: twinType === '1' ? 'Identical twin' : 'Fraternal twin'
        });
        twin1.id = id1;
        twin2.id = id2;

        // Mark twins as linked
        twin1.twinWith = twin2.id;
        twin2.twinWith = twin1.id;
        twin1.twinType = twin2.twinType = twinType === '1' ? 'identical' : 'fraternal';

        // Add to pedigree
        this.pedigreeData.individuals.push(twin1, twin2);
        parent1.childrenIds = parent1.childrenIds || [];
        parent2.childrenIds = parent2.childrenIds || [];
        parent1.childrenIds.push(twin1.id, twin2.id);
        parent2.childrenIds.push(twin1.id, twin2.id);

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert('Twins added successfully!');
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

    renderMarriageLine(group, ind1, ind2) {
        const symbolOffset = 22;
        const x1 = ind1.x < ind2.x ? ind1.x + symbolOffset : ind1.x - symbolOffset;
        const x2 = ind1.x < ind2.x ? ind2.x - symbolOffset : ind2.x + symbolOffset;
        // const y = ind1.y;
        const y = Math.min(ind1.y, ind2.y);
        const noOffspringType = (ind1.noOffspringInfo && ind1.noOffspringInfo.type) || (ind2.noOffspringInfo && ind2.noOffspringInfo.type);


        if (noOffspringType) {
            const midX = (parseFloat(x1) + parseFloat(x2)) / 2;
            const yLine = y + 22; // Just below the marriage line

            // Draw vertical line down from marriage line
            group.appendChild(this.createSvgElement('line', {
                x1: midX, y1: y, x2: midX, y2: yLine, stroke: 'var(--color-text)', 'stroke-width': 2
            }));

            // Draw horizontal bar(s) at the bottom
            if (noOffspringType === 'no_offspring') {
                // Single bar
                group.appendChild(this.createSvgElement('line', {
                    x1: midX - 8, y1: yLine, x2: midX + 8, y2: yLine, stroke: 'var(--color-text)', 'stroke-width': 2
                }));
            } else if (noOffspringType === 'infertility') {
                // Double bars
                group.appendChild(this.createSvgElement('line', {
                    x1: midX - 8, y1: yLine, x2: midX + 8, y2: yLine, stroke: 'var(--color-text)', 'stroke-width': 2
                }));
                group.appendChild(this.createSvgElement('line', {
                    x1: midX - 8, y1: yLine + 4, x2: midX + 8, y2: yLine + 4, stroke: 'var(--color-text)', 'stroke-width': 2
                }));
            }
        }

        const marriageInfo = ind1.marriageInfo || ind2.marriageInfo;
        let lineClass = 'marriage-line';
        if (marriageInfo && (marriageInfo.status === 'divorced' || marriageInfo.status === 'separated')) {
            lineClass += ' marriage-line--separated';
        }

        // Divorced double marriage: single line + two slashes
        if (marriageInfo && marriageInfo.status === 'divorced') {
            // Single horizontal line
            const line = this.createSvgElement('line', { x1, y1: y, x2, y2: y, class: lineClass + ' marriage-line-double' });
            group.appendChild(line);
            // Two slanting lines (slashes)
            const midX = (parseFloat(x1) + parseFloat(x2)) / 2;
            group.appendChild(this.createSvgElement('line', {
                x1: midX - 8, y1: y - 8, x2: midX - 2, y2: y + 8,
                class: 'marriage-line-slash'
            }));
            group.appendChild(this.createSvgElement('line', {
                x1: midX + 2, y1: y - 8, x2: midX + 8, y2: y + 8,
                class: 'marriage-line-slash'
            }));
        } else if (marriageInfo && marriageInfo.status === 'consanguinity') {
            // Double horizontal lines (for consanguinity)
            const offset = 4;
            const line1 = this.createSvgElement('line', { x1, y1: y - offset, x2, y2: y - offset, class: lineClass + ' marriage-line-double' });
            const line2 = this.createSvgElement('line', { x1, y1: y + offset, x2, y2: y + offset, class: lineClass + ' marriage-line-double' });
            group.appendChild(line1);
            group.appendChild(line2);
        } else {
            // Single line (default)
            const line = this.createSvgElement('line', { x1, y1: y, x2, y2: y, class: lineClass });
            group.appendChild(line);

        }
    }


    renderParentChildLines(group, child) {
        if (!child.parentIds || child.parentIds.length === 0) return;

        function parentKey(parentIds) {
            return parentIds ? parentIds.slice().sort().join(',') : '';
        }

        const childParentKey = parentKey(child.parentIds);
        const parents = child.parentIds.map(id => this.getIndividualById(id)).filter(p => p).sort((a, b) => a.position - b.position);
        if (parents.length === 0) return;

        if (parentKey(child.parentIds) !== parentKey(parents.map(p => p.id))) return;


        // When filtering siblings:
        let siblings = this.pedigreeData.individuals.filter(ind =>
            ind.parentIds &&
            ind.parentIds.length === child.parentIds.length &&
            parentKey(ind.parentIds) === childParentKey
        ).sort((a, b) => a.position - b.position);


        if (child.id !== siblings[0].id) return;

        // Save original siblings for drawing lines
        const originalSiblings = siblings.slice();

        // --- Build displaySiblings: left spouse, siblings+middle spouses, right spouse ---
        const displaySiblings = [];
        const leftSibling = siblings[0];
        const rightSibling = siblings[siblings.length - 1];

        // Add leftmost spouse (if any)
        const leftSpouse = leftSibling.spouseId ? this.getIndividualById(leftSibling.spouseId) : null;
        if (
            leftSpouse &&
            leftSpouse.generation === leftSibling.generation &&
            (!leftSpouse.parentIds || parentKey(leftSpouse.parentIds) !== childParentKey) &&
            siblings[0].id !== leftSpouse.id
        ) {
            displaySiblings.push(leftSpouse);
        }

        // Add siblings and their spouses (middle spouses immediately after)
        siblings.forEach((sib, idx) => {
            displaySiblings.push(sib);
            // Only add spouse immediately after if not a twin in a twin pair
            const isTwin = sib.twinWith && siblings.some(s => s.id === sib.twinWith);
            if (
                sib.spouseId &&
                idx !== 0 && idx !== siblings.length - 1 && // not leftmost or rightmost
                !isTwin // <-- do not add spouse after twin in twin pair
            ) {
                const spouse = this.getIndividualById(sib.spouseId);
                if (
                    spouse &&
                    spouse.generation === sib.generation &&
                    (!spouse.parentIds || parentKey(spouse.parentIds) !== childParentKey) &&
                    spouse.id !== leftSpouse?.id // avoid duplicate
                ) {
                    displaySiblings.push(spouse);
                }
            }
        });

        // Add rightmost spouse (if any, and not already added)
        const rightSpouse = rightSibling.spouseId ? this.getIndividualById(rightSibling.spouseId) : null;
        if (
            rightSpouse &&
            rightSpouse.generation === rightSibling.generation &&
            (!rightSpouse.parentIds || parentKey(rightSpouse.parentIds) !== childParentKey) &&
            displaySiblings[displaySiblings.length - 1]?.id !== rightSpouse.id &&
            (!leftSpouse || rightSpouse.id !== leftSpouse.id)
        ) {
            displaySiblings.push(rightSpouse);
        }

        const siblingXs = siblings
            .filter(sib => !sib.spouseId || !siblings.some(s => s.id === sib.spouseId))
            .map(sib => sib.x)
            .sort((a, b) => a - b);

        // For twins, treat the pair as a single unit for endpoints (already handled if twins are adjacent)
        const firstSiblingX = siblingXs[0];
        const lastSiblingX = siblingXs[siblingXs.length - 1];

        // --- Fix: Use parents' generation for sibship line ---
        const parentY = Math.min(...parents.map(p => p.y));
        const sibshipLineY = parentY + 50;

        if (originalSiblings.length === 1 && parents.length === 2) {
            const parent1 = parents[0];
            const parent2 = parents[1];
            const childNode = originalSiblings[0];
            const childX = childNode.x;
            const parentY = parents[0].y;
            const childY = childNode.y - 22; // top of the child symbol

            // Draw a single straight vertical line from parents' midpoint (at child's x) to child
            const lineAttrs = {
                x1: childX, y1: parentY,
                x2: childX, y2: childY,
                class: 'connection-line'
            };
            // If adopted in, use dashed line
            if (childNode.isAdopted && childNode.adoptedDirection === 'in') {
                lineAttrs['stroke-dasharray'] = '4,4';
                lineAttrs['stroke'] = 'var(--color-text)';
                lineAttrs['stroke-width'] = 2;
            }
            group.appendChild(this.createSvgElement('line', lineAttrs));

            return;
        }

        // Multiple siblings: draw standard sibship line
        if (parents.length === 1) {
            group.appendChild(this.createSvgElement('line', { x1: parents[0].x, y1: parentY + 22, x2: parents[0].x, y2: sibshipLineY, class: 'connection-line' }));
        } else if (parents.length === 2) {
            const midParentX = (parents[0].x + parents[1].x) / 2;
            group.appendChild(this.createSvgElement('line', {
                x1: midParentX, y1: parentY, x2: midParentX, y2: sibshipLineY, class: 'connection-line'
            }));
        }
        const nonTwinCount = originalSiblings.filter(sib => !sib.twinWith).length;
        const twinPairsCount = (() => {
            const twinIds = new Set();
            let count = 0;
            originalSiblings.forEach(sib => {
                if (sib.twinWith && !twinIds.has(sib.id)) {
                    twinIds.add(sib.id);
                    twinIds.add(sib.twinWith);
                    count++;
                }
            });
            return count;
        })();

        if (
            originalSiblings.length > 2 ||
            (originalSiblings.length > 1 && nonTwinCount > 0)
        ) {
            if(twinPairsCount > 0){
                console.log('have twins', twinPairsCount);
            }
            // Standard sibship line for >2 siblings or twins + other siblings
            group.appendChild(this.createSvgElement('line', {
                x1: firstSiblingX,
                y1: sibshipLineY,
                x2: lastSiblingX,
                y2: sibshipLineY,
                class: 'connection-line'
            }));
        } else if (originalSiblings.length === 2 && twinPairsCount === 1 && nonTwinCount === 0) {
            // Only one twin pair: draw sibship line only from parents to the twin node (center)
            const centerX = (originalSiblings[0].x + originalSiblings[1].x) / 2;
            let parentX;
            if (parents.length === 1) {
                parentX = parents[0].x;
            } else if (parents.length === 2) {
                parentX = (parents[0].x + parents[1].x) / 2;
            }
            group.appendChild(this.createSvgElement('line', {
                x1: parentX,
                y1: sibshipLineY,
                x2: centerX,
                y2: sibshipLineY,
                class: 'connection-line'
            }));
            // Do NOT draw a line from centerX to left.x or right.x here!
        }


        // --- Twins logic: draw twin symbols and lines ---
        // Find all twin pairs in this sibling group (excluding spouses)
        const twinPairs = [];
        const used = new Set();
        siblings.forEach((sib, idx) => {
            if (sib.twinWith && !used.has(sib.id) && sib.parentIds && parentKey(sib.parentIds) === childParentKey) {
                const twinIdx = siblings.findIndex(s => s.id === sib.twinWith);
                if (twinIdx > idx && twinIdx !== -1) {
                    twinPairs.push([sib, siblings[twinIdx]]);
                    used.add(sib.id);
                    used.add(siblings[twinIdx].id);
                }
            }
        });

        // Draw twin symbols and connect to sibship line
        twinPairs.forEach(([sib1, sib2]) => {
            const [left, right] = sib1.x < sib2.x ? [sib1, sib2] : [sib2, sib1];
            const centerX = (left.x + right.x) / 2;
            const parentLineY = sibshipLineY + 10;
            const parentLineHalf = 15;

            // Draw vertical line from sibship line down to twin symbol
            group.appendChild(this.createSvgElement('line', {
                x1: centerX, y1: sibshipLineY,
                x2: centerX, y2: parentLineY,
                class: 'connection-line'
            }));

            // Draw short parent line centered between twins
            group.appendChild(this.createSvgElement('line', {
                x1: centerX, y1: sibshipLineY,
                x2: centerX, y2: parentLineY,
                class: 'connection-line'
            }));

            // Draw diagonal lines from the twin node to the top of each twin symbol
            group.appendChild(this.createSvgElement('line', {
                x1: centerX, y1: parentLineY,
                x2: left.x, y2: left.y - 22,
                class: 'connection-line'
            }));
            group.appendChild(this.createSvgElement('line', {
                x1: centerX, y1: parentLineY,
                x2: right.x, y2: right.y - 22,
                class: 'connection-line'
            }));

            // For identical twins, draw horizontal line between the centers of the symbols
            if (sib1.twinType === 'identical') {
                let yLine;
                if (left.gender === 'male' && right.gender === 'male') {
                    yLine = left.y;
                } else if (left.gender === 'female' && right.gender === 'female') {
                    yLine = left.y;
                } else {
                    yLine = (left.y + right.y) / 2;
                }
                group.appendChild(this.createSvgElement('line', {
                    x1: left.x + 30, y1: yLine - 90, x2: right.x - 30, y2: yLine - 90, class: 'connection-line'
                }));
            }
        });

        // Draw vertical lines from sibship line to each sibling who is NOT a twin and is not a spouse
        const twinIds = new Set();
        twinPairs.forEach(([sib1, sib2]) => {
            twinIds.add(sib1.id);
            twinIds.add(sib2.id);
        });
        originalSiblings.forEach(sib => {
            if (!twinIds.has(sib.id)) {
                const attrs = {
                    x1: sib.x,
                    y1: sibshipLineY,
                    x2: sib.x,
                    y2: sib.y - 22,
                    class: 'connection-line'
                };
                // If adopted in, use dashed line
                if (sib.isAdopted && sib.adoptedDirection === 'in') {
                    attrs['stroke-dasharray'] = '4,4';
                    attrs['stroke'] = 'var(--color-text)';
                    attrs['stroke-width'] = 2;
                }
                group.appendChild(this.createSvgElement('line', attrs));
            }
        });
    }


    addParent() {
        if (!this.selectedIndividual) return;
        const child = this.selectedIndividual;
        if (child.parentIds && child.parentIds.length >= 2) {
            alert('This individual already has two parents.');
            return;
        }

        // Prompt for parent names
        const name1 = prompt('Enter first parent name:');
        if (!name1) return;
        const gender1 = prompt('Select first parent gender:\n1 = Male\n2 = Female', '1') === '1' ? 'male' : 'female';
        const affected1 = confirm('Is the first parent affected by the condition?');

        const name2 = prompt('Enter second parent name:');
        if (!name2) return;
        const gender2 = gender1 === 'male' ? 'female' : 'male';
        alert(`Second parent will be ${gender2}.`);
        const affected2 = confirm('Is the second parent affected by the condition?');

        // Marital status
        const statusNum = prompt('Enter marital status:\n1 = Married\n2 = Divorced\n3 = Consanguinity', '1');
        let marriageInfo = { status: 'married' };
        if (statusNum === '2') {
            marriageInfo.status = 'divorced';
            marriageInfo.doubleLine = true;
        } else if (statusNum === '3') {
            marriageInfo.status = 'consanguinity';
            marriageInfo.doubleLine = true;
        }

        // Create parents
        const gen = Math.max(1, child.generation - 1);

        // Find next available positions for both parents in their generation
        const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === gen);
        const nextPos = individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position || 0)) + 1 : 1;

        const parent1 = this.createNewIndividual({
            name: name1,
            gender: gender1,
            affected: affected1,
            generation: gen,
            position: nextPos,
            childrenIds: [child.id]
        });
        const parent2 = this.createNewIndividual({
            name: name2,
            gender: gender2,
            affected: affected2,
            generation: gen,
            position: nextPos + 1,
            childrenIds: [child.id]
        });

        // Link as spouses
        parent1.spouseId = parent2.id;
        parent2.spouseId = parent1.id;
        if (parent1.id < parent2.id) {
            parent1.marriageInfo = marriageInfo;
        } else {
            parent2.marriageInfo = marriageInfo;
        }

        // Add parents to data
        this.pedigreeData.individuals.push(parent1, parent2);

        // Assign both parents to child
        child.parentIds = [parent1.id, parent2.id];

        // Add child to both parents' childrenIds (already done above, but ensure no duplicates)
        parent1.childrenIds = parent1.childrenIds || [];
        parent2.childrenIds = parent2.childrenIds || [];
        if (!parent1.childrenIds.includes(child.id)) parent1.childrenIds.push(child.id);
        if (!parent2.childrenIds.includes(child.id)) parent2.childrenIds.push(child.id);

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert(`Parents ${name1} and ${name2} added successfully!`);
    }

    // addParent() {
    //     if (!this.selectedIndividual) return;
    //     const child = this.selectedIndividual;
    //     if (child.parentIds && child.parentIds.length >= 2) {
    //         alert('This individual already has two parents.');
    //         return;
    //     }
    
    //     // Prompt for parent names
    //     const name1 = prompt('Enter first parent name:');
    //     if (!name1) return;
    //     const gender1 = prompt('Select first parent gender:\n1 = Male\n2 = Female', '1') === '1' ? 'male' : 'female';
    //     const affected1 = confirm('Is the first parent affected by the condition?');
    
    //     const name2 = prompt('Enter second parent name:');
    //     if (!name2) return;
    //     const gender2 = gender1 === 'male' ? 'female' : 'male';
    //     alert(`Second parent will be ${gender2}.`);
    //     const affected2 = confirm('Is the second parent affected by the condition?');
    
    //     // Marital status
    //     const statusNum = prompt('Enter marital status:\n1 = Married\n2 = Divorced\n3 = Consanguinity', '1');
    //     let marriageInfo = { status: 'married' };
    //     if (statusNum === '2') {
    //         marriageInfo.status = 'divorced';
    //         marriageInfo.doubleLine = true;
    //     } else if (statusNum === '3') {
    //         marriageInfo.status = 'consanguinity';
    //         marriageInfo.doubleLine = true;
    //     }
    
    //     // Create parents
    //     const gen = Math.max(1, child.generation - 1);
    
    //     // Find next available positions for both parents in their generation
    //     const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === gen);
    //     const nextPos = individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position || 0)) + 1 : 1;
    
    //     const parent1 = this.createNewIndividual({
    //         name: name1,
    //         gender: gender1,
    //         affected: affected1,
    //         generation: gen,
    //         position: nextPos,
    //         childrenIds: [child.id]
    //     });
    //     const parent2 = this.createNewIndividual({
    //         name: name2,
    //         gender: gender2,
    //         affected: affected2,
    //         generation: gen,
    //         position: nextPos + 1,
    //         childrenIds: [child.id]
    //     });
    
    //     // Link as spouses
    //     parent1.spouseId = parent2.id;
    //     parent2.spouseId = parent1.id;
    //     if (parent1.id < parent2.id) {
    //         parent1.marriageInfo = marriageInfo;
    //     } else {
    //         parent2.marriageInfo = marriageInfo;
    //     }
    
    //     // Add parents to data
    //     this.pedigreeData.individuals.push(parent1, parent2);
    
    //     // Assign both parents to child
    //     child.parentIds = [parent1.id, parent2.id];
    
    //     // Add child to both parents' childrenIds (already done above, but ensure no duplicates)
    //     parent1.childrenIds = parent1.childrenIds || [];
    //     parent2.childrenIds = parent2.childrenIds || [];
    //     if (!parent1.childrenIds.includes(child.id)) parent1.childrenIds.push(child.id);
    //     if (!parent2.childrenIds.includes(child.id)) parent2.childrenIds.push(child.id);
    
    //     // // --- SHIFT SUBTREE TO MAKE SPACE FOR NEW ANCESTORS ---
    //     // // 1. Place parents at a default distance apart, centered at child's current x
    //     // const parentSpacing = 120;
    //     // const parentY = this.generationY[gen - 1];
    //     // const childX = typeof child.x === 'number' ? child.x : 700;
    //     // parent1.x = childX - parentSpacing / 2;
    //     // parent2.x = childX + parentSpacing / 2;
    //     // parent1.y = parent2.y = parentY;
    
    //     // // 2. Center child under new parents
    //     // child.x = (parent1.x + parent2.x) / 2;
    
    //     // // 3. Recursively shift all descendants to keep them centered under their parents
    //     // const shiftDescendants = (ind) => {
    //     //     if (!ind.childrenIds || !ind.childrenIds.length) return;
    //     //     const children = ind.childrenIds.map(cid => this.getIndividualById(cid)).filter(Boolean);
    //     //     if (!children.length) return;
    //     //     // Center children under their parents' midpoint
    //     //     const midX = (ind.x + (ind.spouseId ? this.getIndividualById(ind.spouseId)?.x || ind.x : ind.x)) / (ind.spouseId ? 2 : 1);
    //     //     const totalWidth = (children.length - 1) * this.individualSpacing;
    //     //     let startX = midX - totalWidth / 2;
    //     //     children.forEach((child, idx) => {
    //     //         child.x = startX + idx * this.individualSpacing;
    //     //         child.y = this.generationY[child.generation - 1];
    //     //         shiftDescendants(child);
    //     //     });
    //     // };
    //     // shiftDescendants(parent1);
    //     // shiftDescendants(parent2);
        
    //     const proband = this.getIndividualById('III-1');
    //     if (proband) {
    //         // Get all ancestors 3 generations up (great-grandparents)
    //         const allGreatGrandparents = this.getAncestors(proband.id, 3);
    //         // Filter to only those whose id starts with "I"
    //         const greatGrandparents = allGreatGrandparents.filter(anc => anc.id && anc.id.startsWith('I'));
    //         const isGreatGrandparent = greatGrandparents.some(
    //             anc => anc.id === parent1.id || anc.id === parent2.id
    //         );
    //         if (isGreatGrandparent) {
    //             // Shift only the great-grandparents' x positions by 200
    //             greatGrandparents.forEach(ind => {
    //                 console.log('ind', ind.id, ind.x);
    //                 ind.x = (typeof ind.x === 'number' ? ind.x : 700) + 200;
    //                 console.log('ind new x', ind.id, ind.x);
    //             });
    //         }
    //     }
    
    //     this.autoLayout();
    //     this.calculateAllRisks();
    //     this.renderPedigree();
    //     if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
    //     alert(`Parents ${name1} and ${name2} added successfully!`);
    // }

    shiftSubtree(indId, shiftX) {
        const visited = new Set();
        const shift = (currentId) => {
            if (visited.has(currentId)) return;
            visited.add(currentId);
            const individual = this.getIndividualById(currentId);
            if (individual) {
                individual.x = (typeof individual.x === 'number' ? individual.x : 700) + shiftX;
                if (individual.childrenIds && individual.childrenIds.length) {
                    individual.childrenIds.forEach(cid => shift(cid));
                }
            }
        };
        shift(indId);
    }

    getAncestors(indId, generations) {
        const ancestors = new Set();
        const traverse = (currentId, genLeft) => {
            if (genLeft === 0) return;
            const individual = this.getIndividualById(currentId);
            if (individual && individual.parentIds) {
                individual.parentIds.forEach(pid => {
                    if (!ancestors.has(pid)) {
                        ancestors.add(pid);
                        traverse(pid, genLeft - 1);
                    }
                });
            }
        };
        traverse(indId, generations);
        return Array.from(ancestors).map(id => this.getIndividualById(id)).filter(Boolean);
    }

    addSpouse() {
        if (!this.selectedIndividual) return;
        const name = prompt('Enter spouse name:');
        if (!name) return;

        const statusNum = prompt('Enter marital status:\n1 = Married\n2 = Divorced\n3 = Consanguinity', '1');
        const gender = this.selectedIndividual.gender === 'male' ? 'female' : 'male';
        const affected = confirm('Is this spouse affected by the condition?');

        const generation = this.selectedIndividual.generation;
        const spouse = this.createNewIndividual({
            name,
            gender,
            affected,
            generation,
            spouseId: this.selectedIndividual.id
        });

        delete spouse.parentIds;

        this.selectedIndividual.spouseId = spouse.id;

        // Set marriage info after spouse is created
        let marriageInfo = { status: 'married' };
        if (statusNum === '2') {
            marriageInfo.status = 'divorced';
            marriageInfo.doubleLine = true;
        } else if (statusNum === '3') {
            marriageInfo.status = 'consanguinity';
            marriageInfo.doubleLine = true;
        }
        if (this.selectedIndividual.id < spouse.id) {
            this.selectedIndividual.marriageInfo = marriageInfo;
        } else {
            spouse.marriageInfo = marriageInfo;
        }

        this.pedigreeData.individuals.push(spouse);

        // // --- FIX: Add spouse as parent to all existing children ---
        // const parent = this.selectedIndividual;
        // if (parent.childrenIds && parent.childrenIds.length) {
        //     parent.childrenIds.forEach(childId => {
        //         const child = this.getIndividualById(childId);
        //         if (child && Array.isArray(child.parentIds)) {
        //             if (!child.parentIds.includes(spouse.id)) {
        //                 child.parentIds.push(spouse.id);
        //             }
        //         }
        //     });
        // }
        const parent = this.selectedIndividual;
        if (parent.childrenIds && parent.childrenIds.length) {
            parent.childrenIds.forEach(childId => {
                const child = this.getIndividualById(childId);
                if (child) {
                    // Add spouse as parent if not already
                    if (!Array.isArray(child.parentIds)) child.parentIds = [];
                    if (!child.parentIds.includes(spouse.id)) {
                        child.parentIds.push(spouse.id);
                    }
                    // Add child to spouse's childrenIds if not already
                    spouse.childrenIds = spouse.childrenIds || [];
                    if (!spouse.childrenIds.includes(child.id)) {
                        spouse.childrenIds.push(child.id);
                    }
                }
            });
        }

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert(`Spouse ${name} added successfully!`);
    }

    addTermination() {
        // if (!this.selectedIndividual) {
        //     alert('Please select an individual first.');
        //     return;
        // }
        const parent1 = this.selectedIndividual;
        const parent2 = this.getIndividualById(parent1.spouseId);

        // Prompt for type
        const input = prompt('Add Pregnancy Loss:\n1 - Spontaneous miscarriage\n2 - Termination of pregnancy', '1');
        let isTermination = false;
        let remarks = '';
        if (input === '1') {
            isTermination = false;
            remarks = 'Spontaneous miscarriage';
        } else if (input === '2') {
            isTermination = true;
            remarks = 'Termination of pregnancy';
        } else {
            return;
        }

        // Create pregnancy loss child (gender unknown)
        const child = this.createNewIndividual({
            name: isTermination ? 'Termination' : 'Miscarriage',
            gender: 'unknown',
            affected: false,
            generation: Math.min(5, parent1.generation + 1),
            parentIds: parent2 ? [parent1.id, parent2.id] : [parent1.id],
            remarks: remarks,
        });
        child.isTermination = isTermination;
        child.isPregnancyLoss = true; // For clarity

        this.pedigreeData.individuals.push(child);

        // Add child to parents' childrenIds
        parent1.childrenIds = parent1.childrenIds || [];
        parent1.childrenIds.push(child.id);
        if (parent2) {
            parent2.childrenIds = parent2.childrenIds || [];
            parent2.childrenIds.push(child.id);
        }

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert((isTermination ? 'Termination of pregnancy' : 'Spontaneous miscarriage') + ' added successfully!');
    }

    addNoOffspringOrInfertility() {
        if (!this.selectedIndividual) {
            alert('Please select an individual (with spouse) first.');
            return;
        }
        const parent1 = this.selectedIndividual;
        const parent2 = this.getIndividualById(parent1.spouseId);

        if (!parent2) {
            alert('Please select an individual with a spouse.');
            return;
        }

        const input = prompt('Select:\n1 - No offspring by choice\n2 - Infertility', '1');
        if (input !== '1' && input !== '2') return;

        // Mark the relationship
        if (!parent1.noOffspringInfo) parent1.noOffspringInfo = {};
        if (!parent2.noOffspringInfo) parent2.noOffspringInfo = {};

        if (input === '1') {
            parent1.noOffspringInfo.type = 'no_offspring';
            parent2.noOffspringInfo.type = 'no_offspring';
        } else {
            parent1.noOffspringInfo.type = 'infertility';
            parent2.noOffspringInfo.type = 'infertility';
        }

        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert(input === '1' ? 'No offspring by choice added.' : 'Infertility added.');
    }


    addSibling() {
        if (!this.selectedIndividual || !this.selectedIndividual.parentIds || this.selectedIndividual.parentIds.length === 0) {
            alert("Cannot add a sibling to an individual without parents in the chart.");
            return;
        }
        const name = prompt('Enter sibling name:');
        if (!name) return;
        const genderInput = prompt('Select sibling gender:\n1 = Male\n2 = Female\n3 = Unknown', '1');
        let gender;
        if (genderInput === '1') gender = 'male';
        else if (genderInput === '2') gender = 'female';
        else if (genderInput === '3') gender = 'unknown';
        else return;
        const affected = confirm('Is this sibling affected by the condition?');

        // Ask if biological or adopted
        const siblingType = prompt('Is the sibling biological or adopted?\n1 = Biological\n2 = Adopted', '1');
        let adoptedType = null;
        if (siblingType === '2') {
            adoptedType = prompt('Is the sibling adopted into the family or out of the family?\n1 = Adopted In\n2 = Adopted Out', '1');
        }

        const sibling = this.createNewIndividual({
            name, gender, affected,
            generation: this.selectedIndividual.generation,
            parentIds: [...this.selectedIndividual.parentIds]
        });

        // Mark adopted status
        if (siblingType === '2') {
            sibling.isAdopted = true;
            if (adoptedType === '1') {
                sibling.adoptedDirection = 'in';
            } else if (adoptedType === '2') {
                sibling.adoptedDirection = 'out';
            }
        }

        // Lock position after creation

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
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
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
        // Prompt for gender: 1 = Male, 2 = Female, 3 = Unknown
        const genderInput = prompt('Select child gender:\n1 = Male\n2 = Female\n3 = Unknown', '1');
        let gender;
        if (genderInput === '1') gender = 'male';
        else if (genderInput === '2') gender = 'female';
        else if (genderInput === '3') gender = 'unknown';
        else return;
        const affected = confirm('Is this child affected by the condition?');

        // Ask if biological or adopted
        const childType = prompt('Is the child biological or adopted?\n1 = Biological\n2 = Adopted', '1');
        let adoptedType = null;
        if (childType === '2') {
            adoptedType = prompt('Is the child adopted into the family or out of the family?\n1 = Adopted In\n2 = Adopted Out', '1');
        }

        const parentIds = [parent1.id, parent2.id].sort();

        const generation = Math.min(5, parent1.generation + 1);
        // Find next available position in this generation
        const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === generation);
        const nextPos = individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position || 0)) + 1 : 1;

        const child = this.createNewIndividual({
            name, gender, affected,
            generation,
            position: nextPos,
            parentIds
        });

        // Mark adopted status
        if (childType === '2') {
            child.isAdopted = true;
            if (adoptedType === '1') {
                child.adoptedDirection = 'in';
            } else if (adoptedType === '2') {
                child.adoptedDirection = 'out';
            }
        }

        this.pedigreeData.individuals.push(child);
        parent1.childrenIds = parent1.childrenIds || [];
        parent1.childrenIds.push(child.id);
        parent2.childrenIds = parent2.childrenIds || [];
        parent2.childrenIds.push(child.id);

        this.autoLayout();
        this.calculateAllRisks();
        this.renderPedigree();
        if (this.selectedIndividual) this.selectIndividual(this.selectedIndividual.id);
        alert(`Child ${name} added successfully!`);
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
        document.getElementById('deceasedSelect').value = ind.deceased ? 'yes' : 'no';

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
        ind.deceased = document.getElementById('deceasedSelect').value === 'yes';

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
        document.getElementById('addPragnancyBtn').disabled = !sel || sel.generation >= 5;
        document.getElementById('addTwinBtn').disabled = !sel || sel.generation >= 5;
        document.getElementById('addTerminationBtn').disabled = !sel || sel.generation >= 5;
        document.getElementById('addNoOffspringBtn').disabled = !sel || !sel.spouseId;
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
        function parentKey(parentIds) {
            return parentIds ? parentIds.slice().sort().join(',') : '';
        }

        const centerX = 700;
        const spacing = this.individualSpacing;
        const ordered = [];
        const placed = new Set();

        // Sort by position for deterministic layout
        individuals.sort((a, b) => a.position - b.position);

        // Group siblings by parentKey
        const siblingGroups = [];
        const singles = [];
        individuals.forEach(ind => {
            if (Array.isArray(ind.parentIds) && ind.parentIds.length > 0) {
                let found = false;
                const key = parentKey(ind.parentIds);
                for (const group of siblingGroups) {
                    if (parentKey(group.parentIds) === key) {
                        group.members.push(ind);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    siblingGroups.push({ parentIds: ind.parentIds.slice(), members: [ind] });
                }
            } else {
                singles.push(ind);
            }
        });
        // Place sibling groups
        siblingGroups.forEach(group => {
            group.members.sort((a, b) => a.position - b.position);

            // Special case: single child with two parents
            if (group.members.length === 1 && group.parentIds.length === 2) {
                // Find parents from the full pedigree, not just this generation
                const parent1 = this.getIndividualById(group.parentIds[0]);
                const parent2 = this.getIndividualById(group.parentIds[1]);
                const child = group.members[0];
                if (
                    parent1 && parent2 &&
                    typeof parent1.x === 'number' && typeof parent2.x === 'number'
                ) {
                    const marriageMidX = (parent1.x + parent2.x) / 2;
                    const spouse = child.spouseId ? individuals.find(i => i.id === child.spouseId) : null;
                    if (spouse) {

                        // Center the pair as a unit under the marriage line
                        child.x = marriageMidX - spacing / 2;
                        spouse.x = marriageMidX + spacing / 2;
                        child.y = spouse.y = this.generationY[generation - 1];
                        ordered.push(child, spouse);
                        placed.add(child.id);
                        placed.add(spouse.id);
                    } else {
                        child.x = marriageMidX;
                        child.y = this.generationY[generation - 1];
                        ordered.push(child);
                        placed.add(child.id);
                    }
                    return;
                }
            }

            // --- FIX: Special case: single child with one parent and spouse ---
            if (group.members.length === 1 && group.parentIds.length === 1) {
                const parent = this.getIndividualById(group.parentIds[0]);
                const child = group.members[0];
                const spouse = child.spouseId ? individuals.find(i => i.id === child.spouseId) : null;
                if (parent && typeof parent.x === 'number') {
                    if (spouse) {
                        // Space child and spouse apart, centered under the single parent
                        child.x = parent.x - spacing / 2;
                        spouse.x = parent.x + spacing / 2;
                        child.y = spouse.y = this.generationY[generation - 1];
                        ordered.push(child, spouse);
                        placed.add(child.id);
                        placed.add(spouse.id);
                    } else {
                        child.x = parent.x;
                        child.y = this.generationY[generation - 1];
                        ordered.push(child);
                        placed.add(child.id);
                    }
                    return;
                }
            }

            const twinIds = new Set();
            const twinMap = {};
            group.members.forEach(sib => {
                if (sib.twinWith && group.members.some(s => s.id === sib.twinWith)) {
                    twinIds.add(sib.id);
                    twinMap[sib.id] = sib.twinWith;
                }
            });

            group.members.forEach((sib, idx) => {
                if (
                    sib.twinWith &&
                    twinIds.has(sib.id) &&
                    sib.position < (group.members.find(s => s.id === sib.twinWith)?.position || 9999)
                ) {
                    // Place left twin's spouse (if any)
                    const leftTwinSpouse = sib.spouseId ? individuals.find(i => i.id === sib.spouseId) : null;
                    if (
                        leftTwinSpouse &&
                        !placed.has(leftTwinSpouse.id) &&
                        (!leftTwinSpouse.parentIds || parentKey(leftTwinSpouse.parentIds) !== parentKey(sib.parentIds))
                    ) {
                        ordered.push(leftTwinSpouse);
                        placed.add(leftTwinSpouse.id);
                    }

                    // Place left twin
                    if (!placed.has(sib.id)) {
                        ordered.push(sib);
                        placed.add(sib.id);
                    }

                    // Place right twin
                    const rightTwin = group.members.find(s => s.id === sib.twinWith);
                    if (rightTwin && !placed.has(rightTwin.id)) {
                        ordered.push(rightTwin);
                        placed.add(rightTwin.id);

                        // Place right twin's spouse (if any)
                        const rightTwinSpouse = rightTwin.spouseId ? individuals.find(i => i.id === rightTwin.spouseId) : null;
                        if (
                            rightTwinSpouse &&
                            !placed.has(rightTwinSpouse.id) &&
                            (!rightTwinSpouse.parentIds || parentKey(rightTwinSpouse.parentIds) !== parentKey(rightTwin.parentIds))
                        ) {
                            ordered.push(rightTwinSpouse);
                            placed.add(rightTwinSpouse.id);
                        }
                    }
                } else if (!placed.has(sib.id)) {
                    // Non-twin or already placed twin
                    // Place leftmost sibling's spouse (if any)s
                    if (idx === 0) {
                        const leftSpouse = sib.spouseId ? individuals.find(i => i.id === sib.spouseId) : null;
                        if (
                            leftSpouse &&
                            !placed.has(leftSpouse.id) &&
                            (!leftSpouse.parentIds || parentKey(leftSpouse.parentIds) !== parentKey(sib.parentIds))
                        ) {
                            ordered.push(leftSpouse);
                            placed.add(leftSpouse.id);
                        }
                    }

                    ordered.push(sib);
                    placed.add(sib.id);

                    // For middle siblings, place spouse immediately after
                    if (
                        sib.spouseId &&
                        idx !== 0 && idx !== group.members.length - 1 &&
                        !twinIds.has(sib.id)
                    ) {
                        const spouse = individuals.find(i => i.id === sib.spouseId);
                        if (
                            spouse &&
                            !placed.has(spouse.id) &&
                            (!spouse.parentIds || parentKey(spouse.parentIds) !== parentKey(sib.parentIds))
                        ) {
                            ordered.push(spouse);
                            placed.add(spouse.id);
                        }
                    }

                    // Place rightmost sibling's spouse (if any)
                    if (idx === group.members.length - 1) {
                        const rightSpouse = sib.spouseId ? individuals.find(i => i.id === sib.spouseId) : null;
                        if (
                            rightSpouse &&
                            !placed.has(rightSpouse.id) &&
                            (!rightSpouse.parentIds || parentKey(rightSpouse.parentIds) !== parentKey(sib.parentIds))
                        ) {
                            ordered.push(rightSpouse);
                            placed.add(rightSpouse.id);
                        }
                    }

                    // --- FIX: Align single parent above their only child ---

                }
            });
        });

        // Handle single-child group (with or without spouse)
        let handledSingleChild = false;
        if (
            siblingGroups.length === 1 &&
            siblingGroups[0].members.length === 1
        ) {
            const child = siblingGroups[0].members[0];
            const spouse = child.spouseId ? individuals.find(i => i.id === child.spouseId) : null;

            // Try to center under parents' marriage line if possible
            let midX = centerX;
            if (siblingGroups[0].parentIds.length === 2) {
                const parent1 = this.getIndividualById(siblingGroups[0].parentIds[0]);
                const parent2 = this.getIndividualById(siblingGroups[0].parentIds[1]);
                if (parent1 && parent2 && typeof parent1.x === 'number' && typeof parent2.x === 'number') {
                    midX = (parent1.x + parent2.x) / 2;
                }
            }

            child.x = midX;
            child.y = this.generationY[generation - 1];
            placed.add(child.id);
            ordered.push(child);

            if (spouse && !placed.has(spouse.id)) {
                spouse.x = midX + spacing;
                spouse.y = this.generationY[generation - 1];
                placed.add(spouse.id);
                ordered.push(spouse);
            }
            handledSingleChild = true;
        }

        const spousePairs = [];
        individuals.forEach(ind => {
            if (
                ind.spouseId &&
                ind.id < ind.spouseId // Only process one direction
            ) {
                const spouse = individuals.find(i => i.id === ind.spouseId);
                if (
                    spouse &&
                    Array.isArray(ind.parentIds) && ind.parentIds.length > 0 &&
                    Array.isArray(spouse.parentIds) && spouse.parentIds.length > 0
                ) {
                    spousePairs.push([ind, spouse]);
                }
            }
        });

        // spousePairs.forEach(([a, b]) => {
        //     // Find both sets of parents
        //     const aParents = a.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);
        //     const bParents = b.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);

        //     // --- Only if both are the ONLY child of their parents ---
        //     const aSiblings = individuals.filter(i =>
        //         Array.isArray(i.parentIds) &&
        //         i.parentIds.length === a.parentIds.length &&
        //         i.parentIds.every((pid, idx) => pid === a.parentIds[idx])
        //     );
        //     const bSiblings = individuals.filter(i =>
        //         Array.isArray(i.parentIds) &&
        //         i.parentIds.length === b.parentIds.length &&
        //         i.parentIds.every((pid, idx) => pid === b.parentIds[idx])
        //     );

        //     if (
        //         aParents.length === 2 && bParents.length === 2 &&
        //         aParents.every(p => typeof p.x === 'number') &&
        //         bParents.every(p => typeof p.x === 'number') &&
        //         aSiblings.length === 1 && bSiblings.length === 1 // <-- Only child for both
        //     ) {
        //         const aMid = (aParents[0].x + aParents[1].x) / 2;
        //         const bMid = (bParents[0].x + bParents[1].x) / 2;
        //         const pairMid = (aMid + bMid) / 2;
        //         const bigSpacing = this.individualSpacing * 2;
        //         a.x = pairMid - bigSpacing / 2;
        //         b.x = pairMid + bigSpacing / 2;
        //         a.y = b.y = this.generationY[generation - 1];
        //         a._paired = true;
        //         b._paired = true;
        //     }
        // });




        // Standard placement for other sibling groups
        if (!handledSingleChild) {
            // 1. Layout each sibling group centered under their parents' marriage line
            let groupLayouts = [];
            siblingGroups.forEach(group => {
                group.members.sort((a, b) => a.position - b.position);

                // Build display array: siblings, each followed by their spouse (if any)
                const display = [];
                const leftSibling = group.members[0];
                const rightSibling = group.members[group.members.length - 1];

                // Add leftmost spouse (if any)
                const leftSpouse = leftSibling.spouseId ? individuals.find(i => i.id === leftSibling.spouseId) : null;
                if (
                    leftSpouse &&
                    (!leftSpouse.parentIds || parentKey(leftSpouse.parentIds) !== parentKey(leftSibling.parentIds))
                ) {
                    display.push(leftSpouse);
                }

                // Add siblings and their spouses (middle spouses immediately after)
                group.members.forEach((sib, idx) => {
                    display.push(sib);
                    // Only add spouse immediately after if not leftmost or rightmost
                    if (
                        sib.spouseId &&
                        idx !== 0 && idx !== group.members.length - 1
                    ) {
                        const spouse = individuals.find(i => i.id === sib.spouseId);
                        if (
                            spouse &&
                            (!spouse.parentIds || parentKey(spouse.parentIds) !== parentKey(sib.parentIds)) &&
                            !display.includes(spouse)
                        ) {
                            display.push(spouse);
                        }
                    }
                });

                // Add rightmost spouse (if any, and not already added)
                const rightSpouse = rightSibling.spouseId ? individuals.find(i => i.id === rightSibling.spouseId) : null;
                if (
                    rightSpouse &&
                    (!rightSpouse.parentIds || parentKey(rightSpouse.parentIds) !== parentKey(rightSibling.parentIds)) &&
                    !display.includes(rightSpouse)
                ) {
                    display.push(rightSpouse);
                }

                // Center block under parents' marriage line if possible
                let midX = centerX;
                if (group.parentIds.length === 2) {
                    const p1 = this.getIndividualById(group.parentIds[0]);
                    const p2 = this.getIndividualById(group.parentIds[1]);
                    if (p1 && p2 && typeof p1.x === 'number' && typeof p2.x === 'number') {
                        midX = (p1.x + p2.x) / 2;
                    }
                } else if (group.parentIds.length === 1) {
                    const p1 = this.getIndividualById(group.parentIds[0]);
                    if (p1 && typeof p1.x === 'number') {
                        midX = p1.x;
                    }
                }

                const totalWidth = (display.length - 1) * spacing;
                const startX = midX - totalWidth / 2;

                groupLayouts.push({ startX, display });
            });

            // 2. Resolve overlaps between groups by shifting them apart
            groupLayouts.sort((a, b) => a.startX - b.startX);
            let prevRight = null;
            for (let i = 1; i < groupLayouts.length; i++) {
                const prev = groupLayouts[i - 1];
                const curr = groupLayouts[i];
                const prevRight = prev.startX + (prev.display.length - 1) * spacing;
                if (curr.startX <= prevRight + spacing) {
                    // Shift current group to the right to avoid overlap
                    const shift = (prevRight + spacing) - curr.startX;
                    curr.startX += shift;
                }
            }


            // 3. Apply final positions
            groupLayouts.forEach(group => {
                // Always space siblings apart, even if only two
                const n = group.display.length;
                const totalWidth = (n - 1) * spacing;
                group.display.forEach((ind, idx) => {
                    // Always assign position, even if already placed
                    ind.x = group.startX + idx * spacing;
                    ind.y = this.generationY[generation - 1];
                    if (!placed.has(ind.id)) {
                        placed.add(ind.id);
                        ordered.push(ind);
                    }
                });
            });


            // 4. Layout singles (no parents) — put them after groups
            if (groupLayouts.length === 0) {
                // No sibling groups: center singles in the generation
                const totalWidth = (singles.length - 1) * spacing;
                const startX = centerX - totalWidth / 2;
                singles.forEach((ind, idx) => {
                    if (!placed.has(ind.id)) {
                        ind.x = startX + idx * spacing;
                        ind.y = this.generationY[generation - 1];
                        placed.add(ind.id);
                        ordered.push(ind);
                    }
                });
            } else {
                // Sibling groups exist: distribute singles to left and right of all groups
                // Find leftmost and rightmost x of all groups
                const leftMost = Math.min(...groupLayouts.map(g => g.startX));
                const rightMost = Math.max(...groupLayouts.map(g => g.startX + (g.display.length - 1) * spacing));
                singles.forEach((ind, idx) => {
                    if (!placed.has(ind.id)) {
                        if (!ind.locked && ind.id !== this.pedigreeData.probandId) {
                            if (idx % 2 === 0) {
                                ind.x = leftMost - ((Math.floor(idx / 2) + 1) * spacing);
                            } else {
                                ind.x = rightMost + ((Math.floor(idx / 2) + 1) * spacing);
                            }
                            ind.y = this.generationY[generation - 1];
                        }
                        placed.add(ind.id);
                        ordered.push(ind);
                    }
                });
            }

        }

        // individuals.forEach(ind => {
        //     // if (ind._paired) return;
        //     if (
        //         ind.spouseId &&
        //         ind.id < ind.spouseId // Only process one direction
        //     ) {
        //         const spouse = individuals.find(i => i.id === ind.spouseId);
        //         if (
        //             spouse &&
        //             Array.isArray(ind.parentIds) && ind.parentIds.length > 0 &&
        //             Array.isArray(spouse.parentIds) && spouse.parentIds.length > 0
        //         ) {
        //             // Only center if both are the ONLY child of their parents
        //             const aSiblings = individuals.filter(i =>
        //                 Array.isArray(i.parentIds) &&
        //                 i.parentIds.length === ind.parentIds.length &&
        //                 i.parentIds.every((pid, idx) => pid === ind.parentIds[idx])
        //             );
        //             const bSiblings = individuals.filter(i =>
        //                 Array.isArray(i.parentIds) &&
        //                 i.parentIds.length === spouse.parentIds.length &&
        //                 i.parentIds.every((pid, idx) => pid === spouse.parentIds[idx])
        //             );
        //             if (aSiblings.length === 1 && bSiblings.length === 1) {
        //                 const aParents = ind.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);
        //                 const bParents = spouse.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);
        //                 if (
        //                     aParents.length && bParents.length &&
        //                     aParents.every(p => typeof p.x === 'number') &&
        //                     bParents.every(p => typeof p.x === 'number')
        //                 ) {
        //                     const aMid = aParents.length === 2 ? ((aParents[0].x + aParents[1].x) / 2) : aParents[0].x;
        //                     const bMid = bParents.length === 2 ? ((bParents[0].x + bParents[1].x) / 2) : bParents[0].x;
        //                     const pairMid = (aMid + bMid) / 2;
        //                     const spacing = this.individualSpacing;
        //                     if (aParents.length === 2 && bParents.length === 2) {
        //                         ind.x = (pairMid - spacing / 2) - 70;
        //                         spouse.x = (pairMid + spacing / 2) + 70;
        //                     }
        //                     if (aParents.length === 1 && bParents.length === 1) {
        //                         ind.x = pairMid - spacing / 2;
        //                         spouse.x = pairMid + spacing / 2;
        //                     }
        //                     else if (
        //                         (aParents.length === 1 && bParents.length === 2) ||
        //                         (aParents.length === 2 && bParents.length === 1)
        //                     ) {
        //                         ind.x = (pairMid - spacing / 2) - 35;
        //                         spouse.x = (pairMid + spacing / 2) + 35;
        //                     }
        //                     ind.y = spouse.y = this.generationY[generation - 1];
        //                 }
        //             }
        //         }
        //     }
        // });

        spousePairs.forEach(([a, b]) => {
            // Find both sets of parents
            const aParents = a.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);
            const bParents = b.parentIds.map(pid => this.getIndividualById(pid)).filter(Boolean);

            // Find both sets of grandparents
            const aGrandParents = aParents.flatMap(p => p.parentIds || []).map(pid => this.getIndividualById(pid)).filter(Boolean);
            const bGrandParents = bParents.flatMap(p => p.parentIds || []).map(pid => this.getIndividualById(pid)).filter(Boolean);

            // --- Only if both are the ONLY child of their parents ---
            const aSiblings = individuals.filter(i =>
                Array.isArray(i.parentIds) &&
                i.parentIds.length === a.parentIds.length &&
                i.parentIds.every((pid, idx) => pid === a.parentIds[idx])
            );
            const bSiblings = individuals.filter(i =>
                Array.isArray(i.parentIds) &&
                i.parentIds.length === b.parentIds.length &&
                i.parentIds.every((pid, idx) => pid === b.parentIds[idx])
            );

            let aMid, bMid;

            // Fallback if no parents/grandparents
            if (typeof aMid !== 'number') aMid = 700;
            if (typeof bMid !== 'number') bMid = 700;

            const pairMid = (aMid + bMid) / 2;
            const spacing = this.individualSpacing;

            if (
                aParents.length > 0 && bParents.length > 0 &&
                aParents.every(p => typeof p.x === 'number') &&
                bParents.every(p => typeof p.x === 'number')
            ) {

                // if (aGrandParents.length >= 1 && aParents.length === 2) {
                //     let gpMid;
                //     if (
                //         aGrandParents.length === 2 &&
                //         typeof aGrandParents[0].x === 'number' &&
                //         typeof aGrandParents[1].x === 'number'
                //     ) {
                //         gpMid = (aGrandParents[0].x + aGrandParents[1].x) / 2;
                //     } else if (aGrandParents.length === 1 && typeof aGrandParents[0].x === 'number') {
                //         gpMid = aGrandParents[0].x;
                //     }

                //     const parentDistance = 150; // distance between parents
                //     const gpDistance = 200;     // distance between grandparents

                //     if (typeof gpMid === 'number') {
                //         // Position grandparents symmetrically
                //         if (aGrandParents[0]) aGrandParents[0]._desiredX = gpMid - gpDistance / 2;
                //         if (aGrandParents[1]) aGrandParents[1]._desiredX = gpMid + gpDistance / 2;

                //         // Position parents centered under grandparents
                //         if (aParents[0]) aParents[0]._desiredX = gpMid - parentDistance / 2;
                //         if (aParents[1]) aParents[1]._desiredX = gpMid + parentDistance / 2;

                //         // Position children (a and b) centered under parents
                //         const childDistance = spacing + 60; // extra gap for spouses
                //         a.x = gpMid - childDistance / 2;
                //         b.x = gpMid + childDistance / 2;
                //     }
                // }

                if (aSiblings.length === 1 && bSiblings.length === 1) {
                    if (aParents.length === 2 && bParents.length === 2) {
                        a.x = (pairMid - spacing / 2) - 70;
                        b.x = (pairMid + spacing / 2) + 70;
                        if (aGrandParents.length >= 1 && aParents.length === 2) {
                            // Spread a's parents around the midpoint of their own parents (the grandparents)
                            let gpMid;
                            if (aGrandParents.length === 2 && typeof aGrandParents[0].x === 'number' && typeof aGrandParents[1].x === 'number') {
                                gpMid = (aGrandParents[0].x + aGrandParents[1].x) / 2;
                            } else if (aGrandParents.length === 1 && typeof aGrandParents[0].x === 'number') {
                                gpMid = aGrandParents[0].x;
                            }
                            const parentDistance = 120;
                            if (typeof gpMid === 'number') {
                                if (aGrandParents[0]) aGrandParents[0]._desiredX = (gpMid - parentDistance / 2) - 250;
                                if (aGrandParents[1]) aGrandParents[1]._desiredX = (gpMid + parentDistance / 2) - 200;
                                if (aParents[0]) aParents[0]._desiredX = (gpMid - parentDistance / 2) - 165;
                                if (aParents[1]) aParents[1]._desiredX = (gpMid + parentDistance / 2) - 150;
                                a.x = (gpMid - spacing / 2) + 140;
                                b.x = (gpMid + spacing / 2) + 300;
                            }
                        }
                    }
                    else if (aParents.length === 1 && bParents.length === 1) {
                        a.x = (pairMid - spacing / 2);
                        b.x = (pairMid + spacing / 2);
                    }
                    else if (aParents.length === 1 && bParents.length === 2) {
                        a.x = (pairMid - spacing / 2) - 35;
                        b.x = (pairMid + spacing / 2) + 30;
                    }
                    else if (aParents.length === 2 && bParents.length === 1) {
                        a.x = (pairMid - spacing / 2) - 30;
                        b.x = (pairMid + spacing / 2) + 35;
                    }
                }
                // else {
                //     // --- Improved logic: Sibling placement ---
                //     // Find siblings (excluding a and b themselves)
                //     const aSibs = aSiblings.filter(s => s.id !== a.id);
                //     const bSibs = bSiblings.filter(s => s.id !== b.id);
                //     if (aGrandParents.length >= 1 && aParents.length === 2) {

                //         // Spread a's parents around the midpoint of their own parents (the grandparents)
                //         let gpMid;
                //         if (aGrandParents.length === 2 && typeof aGrandParents[0].x === 'number' && typeof aGrandParents[1].x === 'number') {
                //             gpMid = (aGrandParents[0].x + aGrandParents[1].x) / 2;
                //         } else if (aGrandParents.length === 1 && typeof aGrandParents[0].x === 'number') {
                //             gpMid = aGrandParents[0].x;
                //         }
                //         const parentDistance = 120;
                //         if (typeof gpMid === 'number') {
                //             if (aGrandParents[0]) aGrandParents[0]._desiredX = (gpMid - parentDistance / 2) + 250;
                //             if (aGrandParents[1]) aGrandParents[1]._desiredX = (gpMid + parentDistance / 2) + 300;
                //             if (aParents[0]) aParents[0]._desiredX = (gpMid - parentDistance / 2) + 300;
                //             if (aParents[1]) aParents[1]._desiredX = (gpMid + parentDistance / 2) + 350;
                //             // a.x = (gpMid - spacing / 2) + 140;
                //             // b.x = (gpMid + spacing / 2) + 300;
                //         }
                //     }

                //     // Find midpoint between parents
                //     let aMid = aParents.length === 2 ? ((aParents[0].x + aParents[1].x) / 2) : aParents[0].x;
                //     let bMid = bParents.length === 2 ? ((bParents[0].x + bParents[1].x) / 2) : bParents[0].x;
                //     let pairMid = (aMid + bMid) / 2;
                //     const spacing = this.individualSpacing;

                //     // Total number of individuals in the row: b's siblings + a + b + a's siblings
                //     const total = bSibs.length + 2 + aSibs.length;
                //     // Start X so that the couple is always centered at pairMid
                //     let startX = pairMid - ((total - 1) / 2) * spacing;

                //     // Place a's siblings (left side), with their spouses immediately after
                //     let currIdx = 0;
                //     aSibs.forEach((sib) => {
                //         console.log('sib', sib)
                //         sib.x = startX + currIdx * spacing;
                //         sib.y = this.generationY[generation - 1];
                //         currIdx++;
                //         // Place spouse immediately after, if any and not already placed and not in aSibs/bSibs
                //         if (sib.spouseId) {
                //             const spouse = individuals.find(i => i.id === sib.spouseId);
                //             // Only place if spouse is not in aSibs, bSibs, a, or b
                //             if (spouse) {
                //                 spouse.x = startX + currIdx * spacing;
                //                 spouse.y = this.generationY[generation - 1];
                //                 currIdx++;
                //             }
                //         }
                //     });

                //     // Place a (just after a's siblings and their spouses)
                //     a.x = startX + currIdx * spacing;
                //     a.y = this.generationY[generation - 1];
                //     currIdx++;

                //     // Place b (just after a)
                //     b.x = startX + currIdx * spacing;
                //     b.y = this.generationY[generation - 1];
                //     currIdx++;

                //     // Place b's siblings (right side), with their spouses immediately after
                //     bSibs.forEach((sib) => {
                //         sib.x = startX + currIdx * spacing;
                //         sib.y = this.generationY[generation - 1];
                //         currIdx++;
                //         // Place spouse immediately after, if any and not already placed
                //         if (sib.spouseId) {
                //             const spouse = individuals.find(i => i.id === sib.spouseId);
                //             if (spouse) {
                //                 spouse.x = startX + currIdx * spacing;
                //                 spouse.y = this.generationY[generation - 1];
                //                 currIdx++;
                //             }
                //         }
                //     });
                // }
                else {
                    // --- Improved logic: Sibling placement with parent shifting ---
                    // Find siblings (excluding a and b themselves)
                    const aSibs = aSiblings.filter(s => s.id !== a.id);
                    const bSibs = bSiblings.filter(s => s.id !== b.id);
                
                    // Find midpoint between parents
                    let aMid = aParents.length === 2 ? ((aParents[0].x + aParents[1].x) / 2) : aParents[0].x;
                    let bMid = bParents.length === 2 ? ((bParents[0].x + bParents[1].x) / 2) : bParents[0].x;
                    let pairMid = (aMid + bMid) / 2;
                    const spacing = this.individualSpacing;
                
                    // --- Center parents under their own parents (grandparents) ---
                    function centerParentsUnderGrandparents(parents) {
                        if (parents.length === 2) {
                            const gp1 = parents[0].parentIds ? parents[0].parentIds.map(pid => individuals.find(i => i.id === pid)).filter(Boolean) : [];
                            const gp2 = parents[1].parentIds ? parents[1].parentIds.map(pid => individuals.find(i => i.id === pid)).filter(Boolean) : [];
                            if (gp1.length === 2) {
                                const gpMid = (gp1[0].x + gp1[1].x) / 2;
                                const parentDistance = Math.abs(parents[0].x - parents[1].x);
                                parents[0].x = gpMid - parentDistance / 2;
                                parents[1].x = gpMid + parentDistance / 2;
                            }
                            if (gp2.length === 2) {
                                const gpMid = (gp2[0].x + gp2[1].x) / 2;
                                const parentDistance = Math.abs(parents[0].x - parents[1].x);
                                parents[0].x = gpMid - parentDistance / 2;
                                parents[1].x = gpMid + parentDistance / 2;
                            }
                        }
                    }
                    centerParentsUnderGrandparents(aParents);
                    centerParentsUnderGrandparents(bParents);
                
                    // Recompute midpoints after shifting parents
                    aMid = aParents.length === 2 ? ((aParents[0].x + aParents[1].x) / 2) : aParents[0].x;
                    bMid = bParents.length === 2 ? ((bParents[0].x + bParents[1].x) / 2) : bParents[0].x;
                    pairMid = (aMid + bMid) / 2;
                
                    // --- Now layout siblings and couple centered under pairMid ---
                    const total = aSibs.length + 2 + bSibs.length;
                    let startX = pairMid - ((total - 1) / 2) * spacing;
                    let currIdx = 0;
                
                    // Place a's siblings (left side)
                    aSibs.forEach((sib) => {
                        sib.x = startX + currIdx * spacing;
                        sib.y = this.generationY[generation - 1];
                        currIdx++;
                        if (sib.spouseId) {
                            const spouse = individuals.find(i => i.id === sib.spouseId);
                            if (spouse) {
                                spouse.x = startX + currIdx * spacing;
                                spouse.y = this.generationY[generation - 1];
                                currIdx++;
                            }
                        }
                    });
                
                    // Place a
                    a.x = startX + currIdx * spacing;
                    a.y = this.generationY[generation - 1];
                    currIdx++;
                
                    // Place b
                    b.x = startX + currIdx * spacing;
                    b.y = this.generationY[generation - 1];
                    currIdx++;
                
                    // Place b's siblings (right side)
                    bSibs.forEach((sib) => {
                        sib.x = startX + currIdx * spacing;
                        sib.y = this.generationY[generation - 1];
                        currIdx++;
                        if (sib.spouseId) {
                            const spouse = individuals.find(i => i.id === sib.spouseId);
                            if (spouse) {
                                spouse.x = startX + currIdx * spacing;
                                spouse.y = this.generationY[generation - 1];
                                currIdx++;
                            }
                        }
                    });
                }
                a.y = b.y = this.generationY[generation - 1];
                a._paired = true;
                b._paired = true;
            }
        });


        individuals.forEach(ind => {
            if (typeof ind._desiredX === 'number') {
                ind.x = ind._desiredX;
                delete ind._desiredX;
            }
            if (typeof ind.x !== 'number' || isNaN(ind.x)) {
                ind.x = 700; // or your centerX
            }
            if (typeof ind.y !== 'number' || isNaN(ind.y)) {
                ind.y = this.generationY[generation - 1];
            }
        });
    }


    renderIndividual(group, ind) {
        const g = this.createSvgElement('g', { class: 'individual-group', 'data-id': ind.id });
        g.appendChild(this.createIndividualSymbol(ind));
        if (ind.id === this.pedigreeData.probandId) this.addProbandMarker(g, ind);
        g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 6, class: 'individual-text individual-id', fill: ind.affected ? 'var(--color-text)fff' : '#000000' }, ind.id));
        g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 40, class: 'individual-text individual-name' }, this.truncateText(ind.name, 12)));
        if (ind.age || ind.birthYear) {
            const ageInfo = ind.age ? `${ind.age}y` : ind.deathYear ? `${ind.birthYear}-${ind.deathYear}` : `b.${ind.birthYear}`;
            g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y + 52, class: 'individual-text individual-age' }, ageInfo));
        }
        if (ind.calculatedRisks && Object.keys(ind.calculatedRisks).length) {
            const mainRisk = Math.max(...Object.values(ind.calculatedRisks).filter(r => r > 0)) || 0;
            // if (mainRisk > 0) g.appendChild(this.createSvgElement('text', { x: ind.x, y: ind.y - 35, class: 'individual-text risk-percentage' }, `${mainRisk.toFixed(0)}% risk`));
        }

        group.appendChild(g);
    }



    createIndividualSymbol(ind) {
        let g = this.createSvgElement('g', { class: 'individual-symbol', 'data-id': ind.id });

        // --- Adoption brackets and vertical line ---
        if (ind.isAdopted) {
            // Bracket coordinates
            const leftX = ind.x - 35, rightX = ind.x + 35, topY = ind.y - 22, botY = ind.y + 22;
            // Left bracket
            g.appendChild(this.createSvgElement('line', { x1: leftX, y1: topY, x2: leftX, y2: botY, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: leftX, y1: topY, x2: leftX + 8, y2: topY, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: leftX, y1: botY, x2: leftX + 8, y2: botY, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            // Right bracket
            g.appendChild(this.createSvgElement('line', { x1: rightX, y1: topY, x2: rightX, y2: botY, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: rightX - 8, y1: topY, x2: rightX, y2: topY, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: rightX - 8, y1: botY, x2: rightX, y2: botY, stroke: 'var(--color-text)', 'stroke-width': 2 }));

            // Vertical line above symbol
            if (!ind.parentIds || ind.parentIds.length === 0) {
                const lineAttrs = {
                    x1: ind.x, y1: ind.y - 38, x2: ind.x, y2: ind.y - 22,
                    stroke: 'var(--color-text)', 'stroke-width': 2
                };
                if (ind.adoptedDirection === 'in') {
                    g.appendChild(this.createSvgElement('line', {
                        x1: ind.x, y1: ind.y - 38, x2: ind.x, y2: ind.y - 22,
                        stroke: 'var(--color-text)', 'stroke-width': 2, 'stroke-dasharray': '4,4'
                    }));
                }
                g.appendChild(this.createSvgElement('line', lineAttrs));
            }
        }

        // --- Main symbol (circle, square, diamond, pregnancy) ---
        let symbol;
        if (ind.isPregnancy) {
            if (ind.gender === 'female') {
                symbol = this.createSvgElement('circle', {
                    cx: ind.x, cy: ind.y, r: '22',
                    stroke: 'var(--color-text)', 'stroke-dasharray': '4,4', fill: 'none'
                });
            } else if (ind.gender === 'male') {
                symbol = this.createSvgElement('rect', {
                    x: ind.x - 22, y: ind.y - 22, width: '44', height: '44',
                    stroke: 'var(--color-text)', 'stroke-dasharray': '4,4', fill: 'none'
                });
            } else {
                const points = [
                    [ind.x, ind.y - 22],
                    [ind.x + 22, ind.y],
                    [ind.x, ind.y + 22],
                    [ind.x - 22, ind.y]
                ].map(p => p.join(',')).join(' ');
                symbol = this.createSvgElement('polygon', {
                    points,
                    stroke: 'var(--color-text)', 'stroke-dasharray': '4,4', fill: 'none'
                });
            }
        } else if (ind.gender === 'unknown') {
            const points = [
                [ind.x, ind.y - 22],
                [ind.x + 22, ind.y],
                [ind.x, ind.y + 22],
                [ind.x - 22, ind.y]
            ].map(p => p.join(',')).join(' ');
            symbol = this.createSvgElement('polygon', { points });
        } else {
            symbol = this.createSvgElement(ind.gender === 'female' ? 'circle' : 'rect', {
                ...(ind.gender === 'female'
                    ? { cx: ind.x, cy: ind.y, r: '22' }
                    : { x: ind.x - 22, y: ind.y - 22, width: '44', height: '44' })
            });
        }
        this.styleIndividualSymbol(symbol, ind);
        g.appendChild(symbol);

        // Deceased slash
        if (ind.deceased) {
            g.appendChild(this.createSvgElement('line', {
                x1: ind.x - 24, y1: ind.y - 24, x2: ind.x + 24, y2: ind.y + 24,
                stroke: 'var(--color-text)', 'stroke-width': '3'
            }));
        }

        if (ind.isPregnancyLoss) {
            let g = this.createSvgElement('g', { class: 'individual-symbol', 'data-id': ind.id });
            const size = 22;
            const x = ind.x, y = ind.y;
            // Triangle points
            const points = [
                [x, y - size],
                [x - size, y + size],
                [x + size, y + size]
            ];
            // Draw triangle sides
            g.appendChild(this.createSvgElement('line', { x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1], stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: points[1][0], y1: points[1][1], x2: points[2][0], y2: points[2][1], stroke: 'var(--color-text)', 'stroke-width': 2 }));
            g.appendChild(this.createSvgElement('line', { x1: points[2][0], y1: points[2][1], x2: points[0][0], y2: points[0][1], stroke: 'var(--color-text)', 'stroke-width': 2 }));
            // Vertical line above
            g.appendChild(this.createSvgElement('line', { x1: x, y1: y - size - 18, x2: x, y2: y - size, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            // Diagonal cross line for termination only
            if (ind.isTermination) {
                g.appendChild(this.createSvgElement('line', { x1: x - size + 4, y1: y + size - 2, x2: x + size - 4, y2: y - size + 6, stroke: 'var(--color-text)', 'stroke-width': 2 }));
            }
            g.addEventListener('click', e => {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                    if (this.selectedIndividuals.includes(ind.id)) {
                        this.selectedIndividuals = this.selectedIndividuals.filter(id => id !== ind.id);
                    } else {
                        this.selectedIndividuals.push(ind.id);
                    }
                    this.updateMultiSelection();
                } else {
                    this.selectedIndividual = this.getIndividualById(ind.id);
                    this.selectedIndividuals = [ind.id];
                    this.showIndividualInfo(this.selectedIndividual);
                    this.updateRelationshipButtons();
                    this.updateMultiSelection();
                }
            });
            return g; // Only draw this symbol for pregnancy loss
        }

        g.addEventListener('click', e => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                if (this.selectedIndividuals.includes(ind.id)) {
                    this.selectedIndividuals = this.selectedIndividuals.filter(id => id !== ind.id);
                } else {
                    this.selectedIndividuals.push(ind.id);
                }
                this.updateMultiSelection();
            } else {
                this.selectedIndividual = this.getIndividualById(ind.id);
                this.selectedIndividuals = [ind.id];
                this.showIndividualInfo(this.selectedIndividual);
                this.updateRelationshipButtons();
                this.updateMultiSelection();
            }
        });
        return g;
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
        // Draw the cursor arrow, left of the square, pointing right
        const g = this.createSvgElement('g', { transform: `translate(${ind.x - 28},${ind.y - (-10)}) scale(0.7) rotate(70)` });
        g.appendChild(this.createSvgElement('path', {
            d: 'M2,2 L2,32 L10,26 L14,36 L18,34 L14,24 L30,24 Z',
            fill: 'var(--legend-fill)', stroke: 'var(--legend-stroke)', 'stroke-width': 2
        }));
        //     group.appendChild(this.createSvgElement('text', { x: ind.x - 55, y: ind.y + 5, class: 'proband-text' }, 'P'));
        group.appendChild(this.createSvgElement('text', { x: ind.x - 55, y: ind.y + 5, class: 'proband-text' }, 'P'));
        group.appendChild(g);
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
                    <div class="detail-row"><span class="detail-label">Deceased</span><span class="detail-value">${ind.deceased ? 'Yes' : 'No'}</span></div>
                    <div class="detail-row"><span class="detail-label">Spouse</span><span class="detail-value">${spouseName}</span></div>
                    ${ind.age ? `<div class="detail-row"><span class="detail-label">Age</span><span class="detail-value">${ind.age}</span></div>` : ''}
                    ${ind.birthYear ? `<div class="detail-row"><span class="detail-label">Birth Year</span><span class="detail-value">${ind.birthYear}</span></div>` : ''}
                    ${ind.testResult ? `<div class="detail-row"><span class="detail-label">Genetic Test</span><span class="detail-value">${ind.testResult}</span></div>` : ''}
                </div>
                ${this.renderRiskAnalysis(ind)}
                ${ind.conditions ? `<div class="clinical-section"><h5>Medical Conditions</h5><div class="clinical-text">${ind.conditions}</div></div>` : ''}
                ${ind.remarks ? `<div class="clinical-section"><h5>Clinical Remarks</h5><div class="clinical-text">${ind.remarks}</div></div>` : ''}
            </div>
            <div class="detail-grid">
            <button class="btn btn--primary btn--sm" id="editIndividualBtn">Edit Information</button>
            </div>`;

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

    calculateAllRisks() {

        this.pedigreeData.individuals.forEach(ind => {
            ind.calculatedRisks = this.calculateIndividualRisk(ind);
        });
    }

    calculateIndividualRisk(ind) {
        const { inheritancePattern: pattern, carrierFrequency: freq } = this.pedigreeData;

        if (!ind.isAdopted) {
            if (pattern === 'autosomal_dominant') {
                return this.calculateAutosomalDominantRisk(ind);
            } else if (pattern === 'autosomal_recessive') {
                return this.calculateAutosomalRecessiveRisk(ind, freq);
            } else if (pattern === 'x_linked_recessive') {
                return this.calculateXLinkedRecessiveRisk(ind);
            }
            else if (pattern === 'x_linked_dominant') {
                return this.calculateXLinkedDominantRisk(ind);
            }
            return {};
        }
        else {
            return 0;
        }
    }

    calculateAutosomalDominantRisk(ind) {
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

    calculateAutosomalRecessiveRisk(ind, freq) {
        const risks = {};

        // Known states
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

        // Infer from parents
        const parents = ind.parentIds?.map(id => this.getIndividualById(id)).filter(p => p) || [];
        const isParentAffected = parents.some(p => p.affected);
        const areBothParentsCarriers = parents.length === 2 && parents.every(p => this.isKnownCarrier(p));

        if (isParentAffected) {
            risks.carrier = 100;
        } else if (areBothParentsCarriers) {
            risks.carrier = 66.7; // 2/3 chance of being carrier if unaffected
            risks.affected = 25;
        } else {
            // General population risk if no family history
            risks.carrier = 2 * Math.sqrt(freq) * (1 - Math.sqrt(freq)) * 100;
        }

        // Offspring risks if this individual is a known carrier
        if (this.isKnownCarrier(ind)) {
            const spouse = this.getIndividualById(ind.spouseId);
            if (spouse) {
                if (this.isKnownCarrier(spouse)) {
                    risks.offspring_affected = 25;
                    risks.offspring_carrier = 50;
                } else {
                    // Spouse risk from population
                    const spouseCarrierProb = 2 * Math.sqrt(freq) * (1 - Math.sqrt(freq));
                    risks.offspring_affected = spouseCarrierProb * 0.25 * 100;
                }
            }
        }

        return risks;
    }

    calculateXLinkedRecessiveRisk(ind) {
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

    calculateXLinkedDominantRisk(ind){
        const risks = {};

        const mother = this.getIndividualById(ind.parentIds?.find(id => this.getIndividualById(id)?.gender === 'female'));
        const father = this.getIndividualById(ind.parentIds?.find(id => this.getIndividualById(id)?.gender === 'male'));
    
        if (ind.gender === 'male') {
            // Males inherit X from mother
            if (mother && mother.affected) {
                risks.affected = 50; // 50% chance if mother is affected
            }
        } else if (ind.gender === 'female') {
            // Females inherit X from both parents
            if (father && father.affected) {
                risks.affected = 100; // all daughters affected if father is affected
            } else if (mother && mother.affected) {
                risks.affected = 50; // 50% chance if mother is affected
            }
        }
    
        return risks;
    
    }

    isKnownCarrier(ind) {
        if (!ind) return false;
        return ind.carrier || ind.testResult === 'carrier' || ind.affected ||
            (ind.calculatedRisks && ind.calculatedRisks.carrier === 100);
    }

    getAffectedParents(ind) {
        return ind.parentIds?.map(id => this.getIndividualById(id)).filter(p => p?.affected).length || 0;
    }


    createNewIndividual({ name, gender, affected, generation, position, spouseId, parentIds, childrenIds, remarks }) {
        const genRoman = this.toRoman(generation);
        const individualsInGen = this.pedigreeData.individuals.filter(ind => ind.generation === generation);
        const nextPos = position || (individualsInGen.length ? Math.max(...individualsInGen.map(i => i.position)) + 1 : 1);

        return {
            id: `${genRoman}-${nextPos}`,
            name, gender, generation, position: nextPos, affected: affected || false, carrier: false,
            age: '', birthYear: '', deathYear: '', deathAge: '', testResult: '', conditions: '', remarks: remarks || '',
            spouseId: spouseId || null,
            // parentIds: parentIds !== undefined ? parentIds : undefined, // <--- Only set if provided
            parentIds: parentIds ? parentIds.slice().sort() : undefined, // Always sorted!
            childrenIds: childrenIds || [],
            calculatedRisks: {}
        };
    }


    autoLayout() {
        const generations = this.organizeByGenerations();
        Object.values(generations).forEach(gen => {
            // 1. Group siblings by parentIds
            const siblingGroups = [];
            const singles = [];
            gen.forEach(ind => {
                if (Array.isArray(ind.parentIds) && ind.parentIds.length > 0) {
                    // Try to find a group with same parentIds
                    let found = false;
                    for (const group of siblingGroups) {
                        if (
                            group.parentIds.length === ind.parentIds.length &&
                            group.parentIds.every(id => ind.parentIds.includes(id))
                        ) {
                            group.members.push(ind);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        siblingGroups.push({ parentIds: ind.parentIds.slice(), members: [ind] });
                    }
                } else {
                    singles.push(ind);
                }
            });

            // 2. Build new order: siblings (with spouses immediately after), then singles
            const newOrder = [];
            siblingGroups.forEach(group => {
                // Sort siblings by .position
                group.members.sort((a, b) => a.position - b.position);
                // Add all siblings first
                group.members.forEach(sib => newOrder.push(sib));
                // Then add all spouses in the same order as their partners
                group.members.forEach(sib => {
                    if (sib.spouseId) {
                        const spouse = gen.find(i => i.id === sib.spouseId);
                        if (spouse && !newOrder.includes(spouse)) {
                            newOrder.push(spouse);
                        }
                    }
                });
            });
            // Add singles (those with no parents or not in sibling groups)
            singles.forEach(ind => {
                if (!newOrder.includes(ind)) newOrder.push(ind);
                // Place spouse immediately after, if exists and not already in list
                if (ind.spouseId) {
                    const spouse = gen.find(i => i.id === ind.spouseId);
                    if (spouse && !newOrder.includes(spouse)) {
                        newOrder.push(spouse);
                    }
                }
            });

            // 3. Assign positions, but skip locked individuals (like proband)
            let pos = 1;
            newOrder.forEach(ind => {
                if (!ind._skipAutoLayout && !ind.locked && ind.id !== this.pedigreeData.probandId) {
                    ind.position = pos++;
                } else if (!ind._skipAutoLayout && (ind.locked || ind.id === this.pedigreeData.probandId)) {
                    // Still increment pos for locked/proband to reserve their spot
                    pos++;
                }
                // Clean up the flag for future layouts
                delete ind._skipAutoLayout;
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

    // deleteIndividual() {
    //     if (!this.selectedIndividual) return;
    //     if (this.selectedIndividual.id === this.pedigreeData.probandId) {
    //         alert('Cannot delete the proband. To delete this individual, please assign a new proband first.');
    //         return;
    //     }
    //     if (
    //         this.selectedIndividual.parentIds &&
    //         this.selectedIndividual.parentIds.length === 2
    //     ) {
    //         const [parentId1, parentId2] = this.selectedIndividual.parentIds;
    //         const parent1 = this.getIndividualById(parentId1);
    //         const parent2 = this.getIndividualById(parentId2);

    //         if (parent1 && parent2) {
    //             if (confirm(`This individual has two parents (${parent1.name} and ${parent2.name}).\nDo you also want to delete both parents? This cannot be undone.`)) {
    //                 // --- First, update all references to these parents ---
    //                 // Remove child from parents' childrenIds (if still present)
    //                 [parent1, parent2].forEach(parent => {
    //                     if (parent && parent.childrenIds) {
    //                         parent.childrenIds = parent.childrenIds.filter(cid => cid !== this.selectedIndividual.id);
    //                     }
    //                 });

    //                 // Remove spouse link between parents
    //                 if (parent1.spouseId === parent2.id) parent1.spouseId = null;
    //                 if (parent2.spouseId === parent1.id) parent2.spouseId = null;

    //                 // Remove parents from all other individuals' parentIds and spouseId
    //                 this.pedigreeData.individuals.forEach(ind => {
    //                     if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => pid !== parentId1 && pid !== parentId2);
    //                     if (ind.spouseId === parentId1 || ind.spouseId === parentId2) ind.spouseId = null;
    //                     if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => cid !== parentId1 && cid !== parentId2);
    //                 });

    //                 // Remove parents from child's parentIds
    //                 this.selectedIndividual.parentIds = [];

    //                 // --- Now, remove parents from individuals array ---
    //                 this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => ind.id !== parentId1 && ind.id !== parentId2);
    //             }
    //         }
    //     }
    //     if (confirm(`Are you sure you want to delete ${this.selectedIndividual.name}? This cannot be undone.`)) {
    //         const idToDelete = this.selectedIndividual.id;
    //         this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => ind.id !== idToDelete);
    //         this.pedigreeData.individuals.forEach(ind => {
    //             if (ind.spouseId === idToDelete) ind.spouseId = null;
    //             if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => pid !== idToDelete);
    //             if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => cid !== idToDelete);
    //         });
    //         this.closeInfoPanel();
    //         this.renderPedigree();
    //     }
    // }

    deleteIndividual() {
        if (!this.selectedIndividual) return;
        if (this.selectedIndividual.id === this.pedigreeData.probandId) {
            alert('Cannot delete the proband. To delete this individual, please assign a new proband first.');
            return;
        }

        // Check for spouse
        let spouse = null;
        if (this.selectedIndividual.spouseId) {
            spouse = this.getIndividualById(this.selectedIndividual.spouseId);
        }

        let msg = `Are you sure you want to delete ${this.selectedIndividual.name}?`;
        if (spouse) {
            msg += `\nThis will also delete their spouse (${spouse.name}).`;
        }
        msg += ' This cannot be undone.';

        if (!confirm(msg)) return;

        // Collect IDs to delete
        const idsToDelete = [this.selectedIndividual.id];
        if (spouse) idsToDelete.push(spouse.id);

        // Remove from individuals array
        this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => !idsToDelete.includes(ind.id));

        // Remove all references
        this.pedigreeData.individuals.forEach(ind => {
            if (idsToDelete.includes(ind.spouseId)) ind.spouseId = null;
            if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => !idsToDelete.includes(pid));
            if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => !idsToDelete.includes(cid));
        });

        this.closeInfoPanel();
        this.renderPedigree();
        this.autoLayout();
    }

    zoomIn() { this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3); this.applyTransform(); }
    zoomOut() { this.zoomLevel = Math.max(this.zoomLevel * 0.8, 0.3); this.applyTransform(); }
    resetView() { this.zoomLevel = 1; this.panX = this.panY = 0; this.applyTransform(); }
    applyTransform() { document.getElementById('pedigreeChart').style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`; }
    startPan(e) { if (e.target.closest('.individual-group')) return; this.isDragging = true; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; e.preventDefault(); }
    pan(e) { if (!this.isDragging) return; this.panX += e.clientX - this.lastMouseX; this.panY += e.clientY - this.lastMouseY; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; this.applyTransform(); }
    endPan() { this.isDragging = false; }

    // File operations
    // exportChart() {
    //     try {
    //         this.renderPedigree();
    //         const svg = document.getElementById('pedigreeChart');
    //         const svgClone = svg.cloneNode(true);

    //         const colorText = getComputedStyle(document.body).getPropertyValue('--color-text').trim() || '#222';
    //         svgClone.querySelectorAll('style').forEach(s => s.remove());

    //         const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    //         if (!svg.querySelector('style')) {
    //             style.textContent = `
    //             .connection-line { stroke: ${colorText}; stroke-width: 2; }
    //             .marriage-line { stroke: ${colorText}; stroke-width: 2; }
    //             .marriage-line--separated { stroke-dasharray: 4,2; }
    //             .marriage-line-double { stroke: ${colorText}; stroke-width: 2; }
    //             .marriage-line-slash { stroke: ${colorText}; stroke-width: 2; }
    //             .generation-line { stroke: ${colorText}; stroke-width: 1; }
    //             .individual-symbol { stroke: ${colorText}; stroke-width: 2; }
    //             /* Do NOT set fill here, let inline SVG attributes control it */
    //             .individual-text { font-family: Arial, sans-serif; font-size: 14px; fill: ${colorText}; }
    //         `;
    //             svg.insertBefore(style, svg.firstChild);
    //         }
    //         svgClone.insertBefore(style, svgClone.firstChild);

    //         // Serialize the clone, not the live SVG
    //         const svgData = new XMLSerializer().serializeToString(svgClone);

    //         // Show preview modal
    //         const modal = document.getElementById('exportPreviewModal');
    //         const container = document.getElementById('svgPreviewContainer');
    //         container.innerHTML = svgData;
    //         modal.style.display = 'flex';

    //         // Close preview
    //         document.getElementById('closePreviewBtn').onclick = () => {
    //             modal.style.display = 'none';
    //         };

    //         // Confirm export
    //         document.getElementById('confirmExportBtn').onclick = () => {
    //             const blob = new Blob([svgData], { type: 'image/svg+xml' });
    //             const url = URL.createObjectURL(blob);
    //             const link = document.createElement('a');
    //             link.href = url;
    //             link.download = `pedigree-${new Date().toISOString().slice(0, 10)}.svg`;
    //             document.body.appendChild(link);
    //             link.click();
    //             document.body.removeChild(link);
    //             URL.revokeObjectURL(url);
    //             modal.style.display = 'none';
    //             alert('Chart exported successfully as SVG!');
    //         };
    //     } catch (error) {
    //         console.error('Export error:', error);
    //         alert('Error exporting chart.');
    //     }
    // }

    // exportChart() {
    //     try {
    //         this.renderPedigree();
    //         this.debugSvgGroups();

    //         // Clone the SVG so we don't affect the live chart
    //         const svg = document.getElementById('pedigreeChart');
    //         const svgClone = svg.cloneNode(true);

    //         // Remove any existing <style> blocks in the clone
    //         svgClone.querySelectorAll('style').forEach(s => s.remove());

    //         // Get the computed color for lines based on current mode
    //         const colorText = getComputedStyle(document.body).getPropertyValue('--color-text').trim() || '#222';

    //         // Inject export style into the clone
    //         const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    //         style.textContent = `
    //         .connection-line { stroke: ${colorText}; stroke-width: 2; }
    //         .marriage-line { stroke: ${colorText}; stroke-width: 2; }
    //         .marriage-line--separated { stroke-dasharray: 4,2; }
    //         .marriage-line-double { stroke: ${colorText}; stroke-width: 2; }
    //         .marriage-line-slash { stroke: ${colorText}; stroke-width: 2; }
    //         .generation-line { stroke: ${colorText}; stroke-width: 1; }
    //         .individual-symbol { stroke: ${colorText}; stroke-width: 2; }
    //         /* Do NOT set fill here, let inline SVG attributes control it */
    //         .individual-text { font-family: Arial, sans-serif; font-size: 14px; fill: ${colorText}; }
    //     `;
    //         svgClone.insertBefore(style, svgClone.firstChild);

    //         // Serialize the clone, not the live SVG
    //         const svgData = new XMLSerializer().serializeToString(svgClone);

    //         // Show preview modal
    //         const modal = document.getElementById('exportPreviewModal');
    //         const container = document.getElementById('svgPreviewContainer');
    //         const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    //         const previewUrl = URL.createObjectURL(svgBlob);
    //         container.innerHTML = `<iframe src="${previewUrl}" style="width:100%;height:600px;border:none;background:white"></iframe>`;
    //         modal.style.display = 'flex';

    //         // Close preview
    //         document.getElementById('closePreviewBtn').onclick = () => {
    //             modal.style.display = 'none';
    //             URL.revokeObjectURL(previewUrl);
    //         };

    //         // Confirm export
    //         document.getElementById('confirmExportBtn').onclick = () => {
    //             const blob = new Blob([svgData], { type: 'image/svg+xml' });
    //             const url = URL.createObjectURL(blob);
    //             const link = document.createElement('a');
    //             link.href = url;
    //             link.download = `pedigree-${new Date().toISOString().slice(0, 10)}.svg`;
    //             document.body.appendChild(link);
    //             link.click();
    //             document.body.removeChild(link);
    //             URL.revokeObjectURL(url);
    //             modal.style.display = 'none';
    //             alert('Chart exported successfully as SVG!');
    //         };
    //     } catch (error) {
    //         console.error('Export error:', error);
    //         alert('Error exporting chart.');
    //     }
    // }

    // ...existing code...
    exportChart() {
        try {
            this.renderPedigree();
            const svg = document.getElementById('pedigreeChart');
            const svgClone = svg.cloneNode(true);

            // Remove any existing <style> blocks in the clone
            svgClone.querySelectorAll('style').forEach(s => s.remove());

            // Get the computed color for lines based on current mode
            const colorText = getComputedStyle(document.body).getPropertyValue('--color-text').trim() || '#222';

            // Inject export style into the clone
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
            .connection-line { stroke: ${colorText}; stroke-width: 2; }
            .marriage-line { stroke: ${colorText}; stroke-width: 2; }
            .marriage-line--separated { stroke-dasharray: 4,2; }
            .marriage-line-double { stroke: ${colorText}; stroke-width: 2; }
            .marriage-line-slash { stroke: ${colorText}; stroke-width: 2; }
            .generation-line { stroke: ${colorText}; stroke-width: 1; }
            .individual-symbol { stroke: ${colorText}; stroke-width: 2; }
            /* Do NOT set fill here, let inline SVG attributes control it */
            .individual-text { font-family: Arial, sans-serif; font-size: 14px; fill: ${colorText}; }
        `;
            svgClone.insertBefore(style, svgClone.firstChild);

            // Serialize the clone, not the live SVG
            const svgData = new XMLSerializer().serializeToString(svgClone);

            // Show preview modal
            const modal = document.getElementById('exportPreviewModal');
            const container = document.getElementById('svgPreviewContainer');
            container.innerHTML = svgData; // Show SVG directly for best fidelity
            modal.style.display = 'flex';

            // Close preview
            document.getElementById('closePreviewBtn').onclick = () => {
                modal.style.display = 'none';
            };

            // Confirm export
            document.getElementById('confirmExportBtn').onclick = () => {
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `pedigree-${new Date().toISOString().slice(0, 10)}.svg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                modal.style.display = 'none';
                alert('Chart exported successfully as SVG!');
            };
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting chart.');
        }
    }
    // ...existing code...

    exportRiskReport() {
        const report = this.generateRiskReport();
        const blob = new Blob([report], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = `risk-report-${new Date().toISOString().slice(0, 10)}.txt`;
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
            link.download = `pedigree-data-${new Date().toISOString().slice(0, 10)}.json`;
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

    clearData() {
        if (!confirm('Are you sure you want to clear all pedigree data? This cannot be undone.')) return;
        this.pedigreeData = {
            individuals: [],
            probandId: null,
            inheritancePattern: 'autosomal_dominant',
            carrierFrequency: 0.01
        };
        this.selectedIndividual = null;
        this.selectedIndividuals = [];
        this.showStartScreen();
        this.renderPedigree();
        this.updateRelationshipButtons();
        this.closeInfoPanel();
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

    updateMultiSelection() {
        document.querySelectorAll('.individual-symbol.selected').forEach(el => el.classList.remove('selected'));
        this.selectedIndividuals.forEach(id => {
            const symbol = document.querySelector(`.individual-symbol[data-id="${id}"]`);
            if (symbol) symbol.classList.add('selected');
        });
    }

    // deleteSelectedIndividuals() {
    //     // Prevent deleting the proband
    //     const idsToDelete = this.selectedIndividuals.filter(id => id !== this.pedigreeData.probandId);
    //     if (idsToDelete.length === 0) {
    //         alert('Cannot delete the proband. To delete this individual, please assign a new proband first.');
    //         return;
    //     }
    //     if (!confirm(`Are you sure you want to delete the selected individual(s)? This cannot be undone.`)) return;

    //     this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => !idsToDelete.includes(ind.id));
    //     this.pedigreeData.individuals.forEach(ind => {
    //         if (idsToDelete.includes(ind.spouseId)) ind.spouseId = null;
    //         if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => !idsToDelete.includes(pid));
    //         if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => !idsToDelete.includes(cid));
    //     });
    //     this.selectedIndividuals = [];
    //     this.selectedIndividual = null;
    //     this.closeInfoPanel();
    //     this.renderPedigree();
    // }

    deleteSelectedIndividuals() {
        // Prevent deleting the proband
        let idsToDelete = this.selectedIndividuals.filter(id => id !== this.pedigreeData.probandId);

        // Add spouses of selected individuals
        const spouseIds = [];
        idsToDelete.forEach(id => {
            const ind = this.getIndividualById(id);
            if (ind && ind.spouseId && !idsToDelete.includes(ind.spouseId) && ind.spouseId !== this.pedigreeData.probandId) {
                spouseIds.push(ind.spouseId);
            }
        });
        idsToDelete = [...new Set([...idsToDelete, ...spouseIds])];

        if (idsToDelete.length === 0) {
            alert('Cannot delete the proband. To delete this individual, please assign a new proband first.');
            return;
        }

        if (!confirm(`Are you sure you want to delete the selected individual(s)?\nSpouses will also be deleted. This cannot be undone.`)) return;

        this.pedigreeData.individuals = this.pedigreeData.individuals.filter(ind => !idsToDelete.includes(ind.id));
        this.pedigreeData.individuals.forEach(ind => {
            if (idsToDelete.includes(ind.spouseId)) ind.spouseId = null;
            if (ind.parentIds) ind.parentIds = ind.parentIds.filter(pid => !idsToDelete.includes(pid));
            if (ind.childrenIds) ind.childrenIds = ind.childrenIds.filter(cid => !idsToDelete.includes(cid));
        });
        this.selectedIndividuals = [];
        this.selectedIndividual = null;
        this.closeInfoPanel();
        this.renderPedigree();
        this.autoLayout();
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

if (
   !window.location.pathname.endsWith('login.html') &&
   !window.location.pathname.endsWith('register.html') &&
   !getCookie('pedigree_analysis_tool_user')
) {
   window.location.href = 'login.html';
}

if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const application_name = 'pedigree_tool';
            let errorDiv = document.getElementById('loginError');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'loginError';
                errorDiv.className = 'status status--error mt-8';
                loginForm.parentNode.appendChild(errorDiv);
            }
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';

            try {
                const res = await fetch('https://trf-dashboard-bay.vercel.app/api/login-insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password ,application_name})
                });
                const data = await res.json();
                const result = Array.isArray(data) ? data[0] : data;
                if (res.ok && result.status === 200) {
                    // Store user info in cookie (expires in 7 days)
                    document.cookie = `pedigree_analysis_tool_user=${encodeURIComponent(JSON.stringify(result.data))}; path=/; max-age=${60 * 60 * 24 * 7}`;
                    window.location.href = 'index.html';
                } else {
                    errorDiv.textContent = result.message || 'Invalid username or password.';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        });
    }
} else if (window.location.pathname.endsWith('register.html')) {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const hospital_name = document.getElementById('hospital_name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone_no = document.getElementById('phone_no').value.trim();
            const password = Math.random().toString(36).slice(-8);
            let errorDiv = document.getElementById('registerError');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'registerError';
                errorDiv.className = 'status status--error mt-8';
                registerForm.parentNode.appendChild(errorDiv);
            }
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';

            try {
                const payload = {
                    data: {
                        name,
                        hospital_name,
                        email,
                        phone_no,
                        password
                    }
                }
                const res = await fetch('https://trf-dashboard-bay.vercel.app/api/request-insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                const result = Array.isArray(data) ? data[0] : data;
                if (res.ok && result.status === 200) {
                    window.location.href = 'login.html';
                } else {
                    errorDiv.textContent = result.message || 'Registration failed.';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        });
    }
} else {
    new MedicalPedigreeAnalyzer();
}

/**
 * Custom confirm dialog with Yes/No buttons.
 * @param {string} message - The message to display.
 * @returns {Promise<boolean>} Resolves to true if Yes, false if No.
 */
function customConfirm(message) {
    return new Promise((resolve) => {
        // Overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.35)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'flex-start'; // Align to top
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = 9999;

        // Dialog box
        const box = document.createElement('div');
        box.style.background = '#2d2323';
        box.style.color = '#fff';
        box.style.padding = '28px 32px 18px 32px';
        box.style.borderRadius = '14px';
        box.style.boxShadow = '0 2px 24px rgba(0,0,0,0.25)';
        box.style.minWidth = '320px';
        box.style.maxWidth = '90vw';
        box.style.textAlign = 'center';
        box.style.fontSize = '1.08em';
        box.style.marginTop = '40px'; // Add margin from the top

        // Message
        const msg = document.createElement('div');
        msg.style.marginBottom = '22px';
        msg.textContent = message;
        box.appendChild(msg);

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'center';
        btnRow.style.gap = '18px';

        const btnNo = document.createElement('button');
        btnNo.textContent = 'No';
        btnNo.style.background = '#a44';
        btnNo.style.color = '#fff';
        btnNo.style.border = 'none';
        btnNo.style.padding = '8px 28px';
        btnNo.style.borderRadius = '8px';
        btnNo.style.fontSize = '1em';
        btnNo.style.cursor = 'pointer';

        const btnYes = document.createElement('button');
        btnYes.textContent = 'Yes';
        btnYes.style.background = '#f90';
        btnYes.style.color = '#fff';
        btnYes.style.border = 'none';
        btnYes.style.padding = '8px 28px';
        btnYes.style.borderRadius = '8px';
        btnYes.style.fontSize = '1em';
        btnYes.style.cursor = 'pointer';

        btnNo.onclick = () => { document.body.removeChild(overlay); resolve(false); };
        btnYes.onclick = () => { document.body.removeChild(overlay); resolve(true); };

        btnRow.appendChild(btnNo);
        btnRow.appendChild(btnYes);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Keyboard support
        btnYes.focus();
        overlay.tabIndex = -1;
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') { btnNo.click(); }
            if (e.key === 'Enter') { btnYes.click(); }
        };
        overlay.focus();
    });
}
