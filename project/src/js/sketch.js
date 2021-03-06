$(window).on('load',function(){
    $('#startup-modal').modal('show');
});

$(function() {
    $('#btn-modal-start').prop('disabled', true);
    $('#btn-modal-start').click(() => {
        Tone.start();
        userName = $('#txt-username').val();
        let id = socket.id.concat(userNodeCount++);
        addNewNodeToViewAtRandom(id, userName, NODE_TYPES.USER);
        let node = nodeManager.getNode(id);
        nodeManager.setSelectedNode(id);
        socket.emit('add-user-node', {node: id, name: userName, x:node.x, y: node.y, config: node.getSynthName()});
        isStarted = true; // Start interaction handling and drawing.
    });
});


// Socket
let socket = io.connect();
let userNodeCount = 0;
let userName = "";

// State
let isStarted = false;
let isPlaying = false;

// Tone
let masterEnv;
let comp;
let reverb;
let delay;
let vibrato;
let filter;
let nodeConnectionPoint;

// UI
let btnAddNode;
let btnRemoveNode;
let btnClear;
let selSynth;
let btnPlay;

// Global view parameters
let view_max_x_offset = 1000;
let view_min_x_offset = -1000;
let view_max_y_offset = 1000;
let view_min_y_offset = -1000;
let viewOffsetX = 0;
let viewOffsetY = 0;
let viewScale = 1;
let viewWidth;
let viewHeight;


// Node parameters
let nodeManager = null;



function setup() {
    // Setup canvas
    let myCanvas = createCanvas(100,100);
    resizeCanvas(window.innerWidth, window.innerHeight);
    myCanvas.parent('canvas-container');
    background(COLOR_BACKGROUND);

    // Set view limits
    view_max_x_offset = width/2;
    view_min_x_offset = -width/2;
    view_max_y_offset = height/2;
    view_min_y_offset = -height/2;
    viewWidth = view_max_x_offset - view_min_x_offset + width;
    viewHeight = view_max_y_offset - view_min_y_offset + height;
    viewScale = 0.5;

    // Setup UI
    setupUI();

    // Tone Setup
    setupTone();

    // Create Nodes
    nodeManager = new NodeManager();

    socket.on('connect', () => {
        socket.emit('connected');
        $('#btn-modal-start').prop('disabled', false);
    });

}


function draw() {

    background(COLOR_BACKGROUND);

    // Scale view
    translate(width/2, height/2);
    scale(viewScale);
    translate(-width/2, -height/2);

    // Translate view
    updateViewTranslationParameters();

    // Draw
    push();
    translate(viewOffsetX, viewOffsetY);
    drawViewRect();
//    drawGrid();

    nodeManager.drawNodes();
    pop();
}

// Overloads mousePressed of p5.
function mousePressed() {
    if (isStarted) {
        let nodes = nodeManager.getAllNodes();
        for (let node of nodes) {
            let correctedNodeX = ((node.x - width / 2) * viewScale + width / 2) + (viewOffsetX * viewScale);
            let correctedNodeY = ((node.y - height / 2) * viewScale + height / 2) + (viewOffsetY * viewScale);
            let distance = dist(mouseX, mouseY, correctedNodeX, correctedNodeY);
            if (distance < NODE_SIZE * viewScale) { // Node selected
                nodeManager.setSelectedNode(node.getId());
                selSynth.selected(node.getSynthName());
            }
        }
    }
}

/*
 * Overloads mouseWheel of p5.
 * Controls view scaling.
 */
function mouseWheel(event) {
    if (isStarted) {
        viewScale = Math.min(Math.max(viewScale + event.delta * VIEW_SCALE_FACTOR, VIEW_SCALE_MIN), VIEW_SCALE_MAX);
    }
}


/*
 *  Handles translation of the canvas. Updates viewOffsetX and viewOffsetY.
 */
function updateViewTranslationParameters() {
    if (isStarted) {
        if (mouseX === 0 && mouseY === 0) // Hack to avoid translation when page is reloaded.
            return;
        if (mouseX > width - VIEW_TRANSLATION_MARGIN) { // right
            viewOffsetX = Math.max(view_min_x_offset, viewOffsetX - VIEW_TRANSLATION_SPEED);
        }
        if (mouseX < VIEW_TRANSLATION_MARGIN) { //left
            viewOffsetX = Math.min(view_max_x_offset, viewOffsetX + VIEW_TRANSLATION_SPEED);
        }
        if (mouseY > height - VIEW_TRANSLATION_MARGIN) { // bottom
            viewOffsetY = Math.max(view_min_y_offset, viewOffsetY - VIEW_TRANSLATION_SPEED);
        }
        if (mouseY < VIEW_TRANSLATION_MARGIN) { // top
            viewOffsetY = Math.min(view_max_y_offset, viewOffsetY + VIEW_TRANSLATION_SPEED);
        }
    }
}


/*
 * Creates and adds a node to the view such that it doesn't overlap with existing nodes.
 */
function addNewNodeToViewAt(id, name, type, x, y) {
    let created = false;
    if (type === NODE_TYPES.USER)
        created = nodeManager.createUserNode(id, name, x, y, NODE_SIZE, SYNTH_CONFIGS['Mid']);
    else if (type === NODE_TYPES.REMOTE)
        created = nodeManager.createRemoteNode(id, name, x, y, NODE_SIZE, SYNTH_CONFIGS['Mid']);
    if (created)
        nodeManager.connectNode(id, nodeConnectionPoint);
}

/*
 * Creates and adds a node to the view such that it doesn't overlap with existing nodes.
 */
function addNewNodeToViewAtRandom(id, name, type) {
    let totalInterNodeDistance = NODE_SIZE * 2 + MIN_INTER_NODE_DIST;
    let nodes = nodeManager.getAllNodes();
    let newX, newY;
    let overlap = false;
    let added = false;

    let timeLimit = 500;
    let timeStart = millis();

    while (!added) { // Possibility of infinite loop !!

        newX = random(NODE_SIZE, viewWidth - NODE_SIZE) - width/2;
        newY = random(NODE_SIZE, viewHeight - NODE_SIZE) - height/2;
        // newX = width/2;
        // newY = height/2;

        // Check for overlap with all existing nodes
        for (let j=0; j<nodes.length; j++) {
            overlap = dist(newX, newY, nodes[j].x, nodes[j].y) < totalInterNodeDistance;
            if (overlap)
                break;
        }
        if (!overlap) {
            added = true;
            let created = false;
            if (type === NODE_TYPES.USER)
                created = nodeManager.createUserNode(id, name, newX, newY, NODE_SIZE, SYNTH_CONFIGS['Mid']);
            else if (type === NODE_TYPES.REMOTE)
                created = nodeManager.createRemoteNode(id, name, newX, newY, NODE_SIZE, SYNTH_CONFIGS['Mid']);
            if (created) {
                nodeManager.connectNode(id, nodeConnectionPoint);
                return {'x': newX, 'y': newY};
            }
            return null;
        }

        if (millis() - timeStart > timeLimit) {// If cant add within timelimit stop
            console.log('View Full. No more space.');
            return -1;
        }
    }
}


/*
 *  Sets up the audio pipeline.
 *  Sets global variable 'nodeConnectionPoint' to where.
 */
function setupTone() {

    masterEnv = new Tone.AmplitudeEnvelope();
    masterEnv.toMaster();
    masterEnv.triggerAttack();

    comp = new Tone.Compressor();
    comp.connect(masterEnv);

    // reverb = new Tone.Freeverb();
    // reverb.connect(comp);
    //
    // vibrato = new Tone.Vibrato(5.0, 0.1);
    // vibrato.connect(reverb);

    // filter = new Tone.Filter({
    //     type: "lowpass",
    //     frequency: 22050,
    //     rolloff: -12,
    //     Q: 1,
    //     gain: 0
    // });
    // filter.connect(vibrato);

    // Set global node connection point
    nodeConnectionPoint = comp;


    Tone.Transport.scheduleRepeat((time)=>{
        nodeManager.stepAllNodes();
    }, "8n");
    Tone.Transport.bpm.value = 60;
}


function setupUI() {
    let btnWidth = 180;
    let btnHeight = 35;
    let btnSpacing = 100;

    btnAddNode = createButton("Add Node");
    btnAddNode.size(btnWidth, btnHeight);
    btnAddNode.position((width/2 - btnWidth/2) - btnSpacing * 3, height - 50);
    btnAddNode.addClass("myButton");
    btnAddNode.mousePressed(handleAddNode);
    btnAddNode.html("Add Node");

    btnRemoveNode = createButton("Remove Node");
    btnRemoveNode.size(btnWidth, btnHeight);
    btnRemoveNode.position((width/2 - btnWidth/2) - btnSpacing, height - 50);
    btnRemoveNode.addClass("myButton");
    btnRemoveNode.mousePressed(handleRemoveNode);
    btnRemoveNode.html("Remove Node");

    btnClear = createButton("Clear Node");
    btnClear.size(btnWidth, btnHeight);
    btnClear.position((width/2 - btnWidth/2) + btnSpacing, height - 50);
    btnClear.addClass("myButton");
    btnClear.mousePressed(handleClearNode);
    btnClear.html("Clear Node");

    selSynth = createSelect(false);
    selSynth.size(btnWidth, btnHeight);
    selSynth.position((width/2 - btnWidth/2) + btnSpacing * 3, height - 50);
    selSynth.addClass("myButton");
    selSynth.changed(handleChangeSynth);
    for (let instrument in SYNTH_CONFIGS)
        selSynth.option(instrument);
    selSynth.selected(0);

    btnPlay = createButton("Play");
    btnPlay.size(btnWidth, btnHeight);
    btnPlay.position((width/2 - btnWidth/2), height - 100);
    btnPlay.addClass("myButton");
    btnPlay.mousePressed(handleTogglePlay);
    btnPlay.html("Play");
}

function handleClearNode() {
    socket.emit('clear-user-node', {node: nodeManager.getSelectedNodeId()});
    nodeManager.clearUserNode(nodeManager.getSelectedNodeId());
}

function handleAddNode() {
    let id = socket.id.concat(userNodeCount++);
    let success = addNewNodeToViewAtRandom(id, userName, NODE_TYPES.USER);
    if (success !== -1) {
        let node = nodeManager.getNode(id);
        socket.emit('add-user-node', {node: id, name:userName, x:node.x, y: node.y, config: node.getSynthName()});
    }
}

function handleRemoveNode() {
    socket.emit('delete-user-node', {node: nodeManager.getSelectedNodeId()});
    nodeManager.deleteUserNode(nodeManager.getSelectedNodeId());
}

function handleChangeSynth() {
    console.log(selSynth.value());
    let id = nodeManager.getSelectedNodeId();
    nodeManager.setUserNodeSynth(id, selSynth.value());
    nodeManager.connectNode(id, nodeConnectionPoint);
    socket.emit('change-user-synth', {node: id, config: selSynth.value()});
}

function handleTogglePlay() {
    if (isPlaying) {
        Tone.Transport.pause();
        btnPlay.html("Play");
    }
    else {
        Tone.Transport.start();
        btnPlay.html("Pause");
    }
    isPlaying = !isPlaying;
}

function drawGrid() {
    let numHor = 100;
    let numVer = 100;
    translate(-(viewWidth - width)/2, -(viewHeight - height)/2);
    let spacingHor = viewWidth / numHor;
    for (let i=0; i<numHor; i++) {
        stroke(0);
        strokeWeight(1);
        line(i*spacingHor, 0, i*spacingHor, viewHeight);
    }
    let spacingVer = viewHeight / numVer;
    for (let i=0; i<numHor; i++) {
        stroke(0);
        strokeWeight(1);
        line(0, i*spacingVer, viewWidth, i*spacingVer);
    }
    translate((viewWidth - width)/2, (viewHeight - height)/2);
}

function drawViewRect() {
    translate(width/2, height/2);
    fill(COLOR_BACKGROUND_VIEW);
    rectMode(CENTER);
    rect(0,0, viewWidth/viewScale, viewHeight/viewScale);
    translate(-width/2, -height/2);
}

document.addEventListener('keydown', function(event) {
    if (isStarted) {
        if (event.keyCode === 65) { // A
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "C4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "C4"});
        } else if (event.keyCode === 83) { // S
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "D4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "D4"});
        } else if (event.keyCode === 68) { // D
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "E4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "E4"});
        } else if (event.keyCode === 70) { // F
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "F4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "F4"});
        } else if (event.keyCode === 71) { // G
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "G4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "G4"});
        } else if (event.keyCode === 72) { // H
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "A4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "A4"});
        } else if (event.keyCode === 74) { // J
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "B4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "B4"});
        } else if (event.keyCode === 75) { // K
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "C5");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "C5"});
        } else if (event.keyCode === 76) { // L
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "D5");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "D5"});
        } else if (event.keyCode === 186) { // ;
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "E5");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "E5"});
        } else if (event.keyCode === 87) { // W
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "C#4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "C#4"});
        } else if (event.keyCode === 69) { // E
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "D#4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "D#4"});
        } else if (event.keyCode === 84) { // T
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "F#4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "F#4"});
        } else if (event.keyCode === 89) { // Y
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "G#4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "G#4"});
        } else if (event.keyCode === 85) { // U
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "A#4");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "A#4"});
        } else if (event.keyCode === 79) { // O
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "C#5");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "C#5"});
        } else if (event.keyCode === 80) { // P
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), "D#5");
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: "D#5"});
        } else if (event.keyCode === 32) { // SPACE
            nodeManager.addSampleToUserNode(nodeManager.getSelectedNodeId(), null); // Rest
            socket.emit('add-sample-to-user-node', {node: nodeManager.getSelectedNodeId(), note: null});
        }

    }
});

socket.on('add-remote-node', (data) => {
    addNewNodeToViewAt(data.node, data.name, NODE_TYPES.REMOTE, data.x, data.y);
    nodeManager.setRemoteNodeSynth(data.node, data.config);
    nodeManager.connectNode(data.node, nodeConnectionPoint);
});

socket.on('clear-remote-node', (data) => {
  nodeManager.clearRemoteNode(data.node);
});

socket.on('add-sample-to-remote-node', (data) => {
    nodeManager.addSampleToRemoteNode(data.node, data.note);
});

socket.on('change-remote-synth', (data) => {
    nodeManager.setRemoteNodeSynth(data.node, data.config);
    nodeManager.connectNode(data.node, nodeConnectionPoint);
});

socket.on('delete-remote-node', (data) => {
    nodeManager.deleteRemoteNode(data.node);
});




