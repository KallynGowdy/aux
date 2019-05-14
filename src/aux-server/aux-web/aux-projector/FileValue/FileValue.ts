import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {
    Object,
    File,
    Assignment,
    isFormula,
    isAssignment,
    AuxObject,
    AuxFile,
    isDiff,
    merge,
} from '@casual-simulation/aux-common';
import { assign } from 'lodash';
import { appManager } from '../../shared/AppManager';
import uuid from 'uuid/v4';

@Component({
    watch: {
        file: function(newFile: Object, oldFile: Object) {
            const _this: FileValue = this;
            _this._updateValue();
        },
        tag: function(newTag: string, oldTag: string) {
            const _this: FileValue = this;
            _this._updateValue();
        },
        updateTime: function() {
            const _this: FileValue = this;
            _this._updateValue();
        },
    },
})
export default class FileValue extends Vue {
    @Prop() file: AuxObject;
    @Prop() tag: string;
    @Prop() readOnly: boolean;
    @Prop() updateTime: number;
    @Prop({ default: true })
    showFormulaWhenFocused: boolean;

    value: string = '';
    isFocused: boolean = false;
    isFormula: boolean = false;

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    constructor() {
        super();
    }

    async valueChanged(file: AuxFile, tag: string, value: string) {
        this.$emit('tagChanged', file, tag, value);
        if (!isDiff(file)) {
            await this.fileManager.addTagDiff(`${file.id}_${tag}`, tag, value);
            await this.fileManager.updateFile(file, {
                tags: {
                    [tag]: value,
                },
            });
        } else {
            const updated = merge(file, {
                tags: {
                    [tag]: value,
                },
            });
            await this.fileManager.addFileDiff(updated, true);
        }
    }

    focus() {
        this.isFocused = true;
        this._updateValue();

        this.$emit('focusChanged', true);
    }

    blur() {
        this.isFocused = false;
        this._updateValue();
        this._updateAssignment();

        this.$emit('focusChanged', false);
    }

    created() {
        this._updateValue();
    }

    private async _updateValue() {
        this.isFormula = isFormula(this.file.tags[this.tag]);
        if (!this.isFocused || !this.showFormulaWhenFocused) {
            this.value = await this.fileManager.calculateFormattedFileValue(
                this.file,
                this.tag
            );
        } else {
            const val = this.file.tags[this.tag];
            if (isAssignment(val)) {
                const assignment: Assignment = val;
                this.value = assignment.editing
                    ? assignment.formula
                    : assignment.value;
            } else {
                this.value = val;
            }
        }
    }

    private async _updateAssignment() {
        const val = this.file.tags[this.tag];
        if (isAssignment(val)) {
            const assignment: Assignment = val;
            if (assignment.editing) {
                await this.fileManager.updateFile(this.file, {
                    tags: {
                        [this.tag]: assign(assignment, {
                            editing: false,
                        }),
                    },
                });
            }
        }
    }
}
