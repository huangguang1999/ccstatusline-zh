import { Text } from 'ink';
import React, { useMemo } from 'react';

import type { WidgetEditorProps } from '../../types/Widget';
import {
    filterTimezoneOptions,
    getTimezoneMatchSegments,
    getTimezoneOptions
} from '../../utils/timezones';

import { SearchableOptionEditor } from './searchable-option-editor';
import {
    getUsageTimezone,
    setUsageTimezone
} from './usage-display';

export const TIMEZONE_EDITOR_ACTION = 'edit-timezone';

export function renderUsageTimezoneEditor(props: WidgetEditorProps): React.ReactElement {
    return <UsageTimezoneEditor {...props} />;
}

export const UsageTimezoneEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel, action }) => {
    const currentTimezone = getUsageTimezone(widget);
    const options = useMemo(() => getTimezoneOptions(currentTimezone), [currentTimezone]);

    if (action !== TIMEZONE_EDITOR_ACTION) {
        return <Text>未知编辑模式</Text>;
    }

    return (
        <SearchableOptionEditor
            title='时区'
            currentLabel={currentTimezone ?? 'UTC'}
            initialValue={currentTimezone ?? 'UTC'}
            options={options}
            filterOptions={filterTimezoneOptions}
            getMatchSegments={getTimezoneMatchSegments}
            emptyMessage='没有匹配的时区。'
            onSelect={(timezone) => { onComplete(setUsageTimezone(widget, timezone)); }}
            onCancel={onCancel}
        />
    );
};
